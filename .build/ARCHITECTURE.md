# ARCHITECTURE.md — GlyphJet

Ngày: 2026-07-12 (updated sau ChatGPT advice + GLM review)
Phase: 2 (Architecture) — [GATE, chờ user duyệt lần cuối]

Tham chiếu: PRODUCT.md (failure modes F1-F12, B1-B7).

Cập nhật lần này (resolve GLM NEEDS_REVISION + ChatGPT advice):
- ADR-01: thêm ADR-06 rename product `Icon Windows → GlyphJet`
- ADR-05: đổi default `Win+; → Alt+;`, Win+; chỉ experimental, bỏ fallback chain
- Section 4.1 IconItem: thêm field `cp?: string`
- Section 4.2 taxonomy: viết mapping đầy đủ 93 kaomoji + 26 symbol category + catch-all policy
- Section 4.3 settings: thêm `last_type` + `last_category` (browse state continuity)
- F1 mitigation: rewrite theo ADR-05 mới (không fallback chain)
- F3 mitigation: bỏ Web Worker, main thread + debounce đủ
- Section 9 open questions: bỏ (cả 3 đã chốt với user)

---

## 1. Stack decision

### ADR-01: Shell = Rust + Tauri v2

**Context.** Cần native Windows shell lo 4 việc chỉ native làm được: (1) register global hotkey toàn cục, (2) write clipboard CF_UNICODETEXT, (3) borderless transparent spotlight window steal focus, (4) system tray icon. Shell phải nhẹ (< 15MB installer, < 60MB RAM idle) và để frontend TypeScript reuse 100% `search.ts` của web.

**Decision.** Rust + Tauri v2 (Rust 1.89.0, Tauri CLI 2.7.1 đã cài).

**Alternatives.**

| Option | Pro | Con | Verdict |
|---|---|---|---|
| **Tauri v2 (Rust)** | Binary nhỏ ~3-8MB, WebView2 sẵn Win11, plugin chính thức global-shortcut/clipboard/tray/single-instance, reuse TS | Lần đầu build Rust cần MSVC build tools | **CHỌN** |
| Electron | Ecosystem lớn | Installer 80-150MB, RAM 150-300MB idle, vi phạm ràng buộc < 15MB | Bỏ |
| C# WPF / WinUI 3 | Native nhất | Phải port `search.ts` sang C# → drift với web, mất đầu tư thuật toán | Bỏ |
| Pure Rust (egui/iced) | Binary cực nhỏ | Không reuse `search.ts` + FlexSearch | Bỏ |
| Python + PyQt | Nhanh code | Installer 40-80MB (PyInstaller bundle Python), startup 500ms+ | Bỏ |
| AutoHotkey + HTML dialog | Cực nhẹ | Search phải port, maintain đau | Bỏ |

**Evidence.**
- `tauri-plugin-global-shortcut` v2 chính thức: register/unregister hotkey, JS + Rust API. Doc: https://v2.tauri.app/plugin/global-shortcut/ (fetch 2026-07-12).
- `tauri-plugin-clipboard-manager` v2: read/write plain-text. Doc: https://v2.tauri.app/plugin/clipboard/.
- Tray icon v2 dùng `TrayIconBuilder` built-in. Doc: https://v2.tauri.app/plugin/system-tray/.
- WebView2 runtime bundle mặc định Windows 11.

**Consequences.**
- + Phù hợp ràng buộc < 15MB installer.
- + Frontend chạy trên WebView2 (Chromium V8), FlexSearch hoạt động y hệt browser.
- - Warmup webview cold start cần thiết kế (F2 mitigation).
- - Phải cài MSVC Build Tools nếu chưa có (check Phase 3).

**Reversibility.** Cao. Frontend TS portable, nếu Tauri fail có thể bọc sang Electron giữ nguyên frontend.

### ADR-02: Frontend = TypeScript + Vite, KHÔNG dùng React

**Context.** Popup nhỏ (480x360), UI đơn giản. React + JSX overkill, kéo bundle size và complexity.

**Decision.** TypeScript + Vite thuần, DOM manipulation trực tiếp, CSS thuần. Port nguyên `search.ts` từ web.

**Alternatives.** React (overkill, bundle 130KB+), Svelte (thêm toolchain). Bỏ cả hai.

### ADR-03: Search = FlexSearch chạy trong webview, KHÔNG port sang Rust

**Context.** Web đã đầu tư `search.ts` 14KB / 370 dòng với FlexSearch forward index + alias map + exact-glyph O(1) + quality ranking + typo-light Levenshtein. Port Rust = reimplement + drift.

**Decision.** Copy `search.ts` + `data.json` nguyên sang frontend Tauri. FlexSearch chạy trong WebView2 (Chromium V8).

**Alternatives.** Port Rust (tantivy/Meilisearch — reimplement, drift, binary phình), SQLite FTS5 (reimplement ranking). Bỏ cả.

**Verified.** data.json count = 14.870 (9.884 kaomoji / 3.091 symbol / 1.895 emoji) khớp 100% spec. search.ts 14.444 bytes / 370 dòng khớp. Schema data fields `{t, y, c, s, n, g, cp?}` — `cp` có ở 3.091 symbol items, `search.ts` `SearchItem` interface line 14 có `cp?: string`.

### ADR-04: Storage = JSON bundle + Tauri Store plugin cho settings

**Context.** 2 loại data: (1) catalog 14.870 icon (read-only, bundle), (2) settings user (read/write ít).

**Decision.**
- Catalog: `data.json` (1.9MB) bundle `src-tauri/resources/`, load 1 lần khi webview init.
- Settings: `tauri-plugin-store` (JSON trong app data dir), read/write tức thì.

### ADR-05: Hotkey = Alt+; default, Win+; experimental (KHÔNG cướp Microsoft)

**Context.** (Revised sau ChatGPT advice + GLM review). Microsoft `TextInputHost.exe` hook Win+; và Win+. ở mức thấp. Tauri global-shortcut dùng `RegisterHotKey` Win32, **không cướp được shortcut OS reserve**. Verified bằng Microsoft Learn: tổ hợp chứa phím Windows được OS dành riêng, `RegisterHotKey` fail nếu combination đã registered hoặc reserved. Raw Input sai tool (device input, không phải shortcut override). `WH_KEYBOARD_LL` là escape hatch (silent removal risk, conflict order không guaranteed). Registry `EnableExpressiveInputShellHotkey` brittle trên Win11 (Microsoft Q&A confirm key đôi khi không tồn tại).

**Decision.**
- Default hotkey: **`Alt+;`** (an toàn, register được reliably).
- `Win+;` chỉ là **optional experimental** setting (user tự chịu rủi ro nếu muốn thử cướp Microsoft).
- **KHÔNG silent fallback chain** (bỏ `Win+;→Win+.→Ctrl+Space`). Register fail → báo lỗi rõ trong UI + yêu cầu user chọn hotkey khác.
- **KHÔNG tự sửa registry** v1.
- **KHÔNG dùng WH_KEYBOARD_LL** v1 (chỉ thêm sau nếu test thực tế chứng minh cần + user opt-in).

**Alternatives considered.**

| Hướng | Pro | Con | Verdict |
|---|---|---|---|
| Win+; default + guide disable MS panel | Đúng mental model thay emoji panel | Register không reliably, MS panel có thể mở thay app, first-run UX fail | Bỏ default |
| Alt+; default | Register được reliably, first-run deterministic, sạch (không registry/hook) | User phải học shortcut mới, Alt là menu access key ở vài app | **CHỌN** |
| Ctrl+Space | Rất tiện | IME switch default East Asian, code completion IDE, conflict cao | Bỏ |
| Alt+Space | Tiện | PowerToys Run + system menu Windows | Bỏ |
| WH_KEYBOARD_LL cướp Win+; | Có thể hoạt động | Silent removal risk, hook toàn hệ thống, không guaranteed | Bỏ v1 |

**Gotcha flag.** `Alt` là menu access key trong nhiều app desktop (Word, Excel, VSCode). `Alt+;` có thể trigger menu accelerator ở vài app. Trên máy target test OK thì giữ, Settings phải capture theo accelerator thật (physical key) mà Tauri hỗ trợ, không hardcode text label giả định US ANSI layout.

**Consequences.**
- + First-run deterministic, không fail silent.
- + Code sạch, không hook/registry/driver.
- + Support burden thấp, không phụ thuộc hành vi Windows Shell.
- - User phải học `Alt+;` thay vì dùng `Win+;` quen thuộc.
- - Public release sau này vẫn cần hotkey riêng (không thay emoji panel Microsoft được reliably).

### ADR-06: Product identity = GlyphJet

**Context.** Working title cũ "Icon Windows" sai semantic (emoji/kaomoji không phải icon), nghe như thư mục `.ico`, khó sở hữu identity. Folder `icon-windown` sai chính tả.

**Decision.** Rename toàn bộ:
- Product name: **GlyphJet**
- Tagline: "GlyphJet — instant emoji, symbols and kaomoji."
- Folder / repo: `glyphjet`
- Executable: `GlyphJet.exe`
- Package id: `com.quoc.glyphjet`

**Lý do.** "glyph" đúng abstraction (ký tự hiển thị, bao trùm emoji + Unicode symbol + kaomoji). "Jet" truyền tốc độ (< 150ms open). Collision bề mặt thấp (GitHub/Product Hunt check không có project nổi bật cùng tên exact). Không khóa vào Windows (v1 Windows nhưng tên sống được nếu port sau).

**Reversibility.** Cao. Phase 2 chưa code, rename folder rẻ giờ, để sau thành nợ kỹ thuật.

---

## 2. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────┐
│  Tauri v2 process (Rust) — GlyphJet.exe             │
│                                                     │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐   │
│  │ hotkey.rs  │   │ window.rs  │   │ tray.rs    │   │
│  │ Alt+;      │   │ spotlight  │   │ icon+menu  │   │
│  └─────┬──────┘   └─────┬──────┘   └─────┬──────┘   │
│        │                │                 │          │
│        ▼                ▼                 ▼          │
│  ┌──────────────────────────────────────────────┐   │
│  │            commands.rs (Tauri IPC)           │   │
│  │  copy_glyph / show_popup / hide_popup /      │   │
│  │  get_settings / save_settings / register_hk  │   │
│  └────────────────────┬─────────────────────────┘   │
│                       │ invoke                     │
│  ┌────────────────────▼─────────────────────────┐   │
│  │     WebView2 (Chromium, hidden by default)   │   │
│  │                                              │   │
│  │  ┌─────────┐  ┌──────────┐  ┌────────────┐  │   │
│  │  │main.ts  │  │search.ts │  │taxonomy.ts │  │   │
│  │  │UI wire  │  │FlexSearch│  │cat mapping │  │   │
│  │  └─────────┘  └──────────┘  └────────────┘  │   │
│  │  ┌──────────────────────────────────────┐   │   │
│  │  │     data.json (14,870 items)         │   │   │
│  │  │     bundle in src-tauri/resources/   │   │   │
│  │  └──────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
           │
           ▼ clipboard-manager plugin
     CF_UNICODETEXT (glyph text)
```

---

## 3. Data access patterns

| Pattern | Tần suất | Storage | Notes |
|---|---|---|---|
| Load catalog 1 lần | 1 khi app start | `src-tauri/resources/data.json` (1.9MB) | Cache in-memory webview, không reload |
| Build search index | 1 khi load catalog xong | In-memory FlexSearch | Forward index, ~5-10MB heap |
| Search query | Mỗi ký tự (debounce 120ms) | FlexSearch lookup main thread | Max 48 results, abort query cũ |
| Browse type+category | Mỗi click tab/chip | Filter in-memory theo `y` + `c` | Alphabetical sort |
| Copy glyph | Mỗi click icon | Clipboard write `clipboard-manager` | CF_UNICODETEXT only |
| Read settings | 1 khi start + khi user mở Settings UI | `tauri-plugin-store` JSON | hotkey, startup, last_type, last_category |
| Write settings | Khi user đổi hotkey/browse type/cat | `tauri-plugin-store` JSON | Atomic write, debounce 250-500ms khi browse |

---

## 4. Data model

### 4.1 IconItem (giữ nguyên schema data.json, thêm cp)

```
{
  "t": "🐻",            // text glyph (copy target)
  "y": "emoji",         // type: emoji | symbol | kaomoji
  "c": "animals-nature", // category
  "s": "animal-mammal",  // subcategory
  "n": "bear",          // display name
  "g": "bear animal emoji", // tags (searchable)
  "cp": "1F43B"         // codepoint, OPTIONAL — có ở 3.091 symbol items
}
```

`cp` optional (chỉ symbol có), `search.ts` `SearchItem` interface line 14 có `cp?: string` → `types.ts` phải include. Không đổi schema data → reuse `search.ts` nguyên.

### 4.2 Category mapping (build-time output, full 93 kaomoji + 26 symbol)

Build script Python gộp category thô thành nhóm thân thiện. Output `taxonomy.json`.

**Policy catch-all (bắt buộc):** mọi category trong data.json PHẢI có trong mapping. Nếu data update có category mới chưa match → build script validate + fail loud (không silent drop). Items có category không match → vào nhóm "Misc" tương ứng + warning log.

#### Emoji (9 nhóm, cover 9/9 category — 1.895 item)

```
"emoji": [
  {"id": "smileys", "label": "Smileys & Emotion", "categories": ["smileys-emotion"]},
  {"id": "people", "label": "People & Body", "categories": ["people-body"]},
  {"id": "animals", "label": "Animals & Nature", "categories": ["animals-nature"]},
  {"id": "food", "label": "Food & Drink", "categories": ["food-drink"]},
  {"id": "travel", "label": "Travel & Places", "categories": ["travel-places"]},
  {"id": "activities", "label": "Activities", "categories": ["activities"]},
  {"id": "objects", "label": "Objects", "categories": ["objects"]},
  {"id": "symbols-emoji", "label": "Symbols", "categories": ["symbols"]},
  {"id": "flags", "label": "Flags", "categories": ["flags"]}
]
```

#### Symbol (11 nhóm, cover 26/26 category — 3.091 item)

```
"symbol": [
  {"id": "arrows", "label": "Arrows", "categories": ["arrows", "supplemental-arrows", "miscellaneous-and-arrows", "transport-and-map"]},
  {"id": "math", "label": "Math", "categories": ["mathematical-operators", "supplemental-mathematical-operators", "miscellaneous-mathematical-symbols"]},
  {"id": "currency", "label": "Currency", "categories": ["currency"]},
  {"id": "shapes", "label": "Geometric Shapes", "categories": ["geometric-shapes", "geometric-shapes-extended"]},
  {"id": "technical", "label": "Technical", "categories": ["miscellaneous-technical"]},
  {"id": "text-punctuation", "label": "Text & Punctuation", "categories": ["general-punctuation"]},
  {"id": "letters-numbers", "label": "Letters & Numbers", "categories": ["letterlike", "number-forms", "superscripts-and-subscripts", "alphabetic-presentation-forms", "greek-and-coptic", "cyrillic"]},
  {"id": "boxes-blocks", "label": "Boxes & Blocks", "categories": ["box-drawing", "block-elements"]},
  {"id": "dingbats", "label": "Dingbats", "categories": ["dingbats", "ornamental-dingbats"]},
  {"id": "games", "label": "Games & Chess", "categories": ["chess"]},
  {"id": "misc-symbol", "label": "Miscellaneous", "categories": ["miscellaneous", "miscellaneous-and-pictographs", "supplemental-and-pictographs"]}
]
```

#### Kaomoji (15 nhóm, cover 93/93 category — 9.884 item)

```
"kaomoji": [
  {"id": "happy", "label": "Happy & Positive",
   "categories": ["happy", "laughing", "excited", "friend", "winking", "wink", "smug", "thumbs-up", "triumph-and-success", "hello-and-hi", "good-morning", "good-night", "thank-you", "japanese-smiley-face", "blushing", "angel"]},
  {"id": "love", "label": "Love & Flirty",
   "categories": ["love", "kissing", "kiss", "flirty", "cute"]},
  {"id": "shy", "label": "Shy & Hiding",
   "categories": ["shy", "hiding"]},
  {"id": "sad", "label": "Sad & Worried",
   "categories": ["sad", "crying", "worried", "depressed", "helpless", "apologizing", "nervous", "giving-up"]},
  {"id": "angry", "label": "Angry & Violent",
   "categories": ["angry", "fighting-weapons-and-violent", "evil", "devil", "middle-finger", "disapproval"]},
  {"id": "table-flip", "label": "Table Flip & Rage",
   "categories": ["table-flipping", "flip-table"]},
  {"id": "surprised", "label": "Surprised & Confused",
   "categories": ["surprised", "confused", "meh", "scared", "wtf", "weird"]},
  {"id": "sick", "label": "Sick & Hurt",
   "categories": ["hurt-or-sick", "vomiting", "dead", "nose-bleed"]},
  {"id": "thinking", "label": "Thinking & Sleeping",
   "categories": ["thinking", "sleeping", "flexing", "shrug"]},
  {"id": "actions", "label": "Actions",
   "categories": ["waving", "running", "dancing", "saluting", "hugging", "writing", "eating", "please", "holiday", "christmas", "music", "other-action"]},
  {"id": "cool", "label": "Cool & Sunglasses",
   "categories": ["emoticons-with-sunglasses", "sunglasses", "mustache", "crazy"]},
  {"id": "animals-nature", "label": "Animals & Nature",
   "categories": ["bear", "cat", "dog", "bird", "rabbit", "sheep", "monkey", "pig", "fish", "spider", "other-animal", "flower"]},
  {"id": "food-objects", "label": "Food & Objects",
   "categories": ["food-and-drink", "hungry", "emoticon-objects", "gun", "sword", "cloud"]},
  {"id": "meme", "label": "Meme & Character",
   "categories": ["character-and-meme", "dongers", "random"]},
  {"id": "misc-kaomoji", "label": "Misc (catch-all)",
   "categories": ["uncategorized", "misc", "other"]}
]
```

**Verify cover 93/93:**
- happy 16, love 5, shy 2, sad 8, angry 6, table-flip 2, surprised 6, sick 4, thinking 4, actions 12, cool 4, animals 12, food-objects 6, meme 3, misc 3 = **93**. Khớp.

### 4.3 Settings (updated: thêm browse state continuity)

```
{
  "hotkey": "Alt+;",
  "launch_on_startup": true,
  "popup_position": "center",
  "last_type": "emoji",         // browse state — restore last type
  "last_category": "smileys"    // browse state — restore last category
}
```

**Browse restore logic** (resolve ChatGPT advice #3):
- Mở popup: read `last_type` + `last_category`.
- Validate: type hợp lệ (emoji/symbol/kaomoji)? category thuộc type + còn tồn tại?
- Valid → restore. Invalid / first run (không settings) → fallback Emoji → Smileys.
- Query luôn reset rỗng mỗi lần mở. Mode mặc định browse.
- Không restore scroll position v1. Không restore selected cell v1.
- Lần trước popup đóng khi đang search → lần sau vẫn mở browse tại last browse category (không nhớ search state).
- Write `last_type`/`last_category` khi user đổi type/category trong browse (debounce 250-500ms, atomic write).

---

## 5. Module boundaries

### 5.1 Rust shell (`src-tauri/src/`)

| File | Trách nhiệm | Không được làm |
|---|---|---|
| `main.rs` | Entry, init Tauri builder + plugins | Không chứa logic business |
| `hotkey.rs` | Register/unregister global shortcut (Alt+; default), handle event | Không call clipboard trực tiếp, không tự sửa registry |
| `window.rs` | Show/hide spotlight, position, focus steal, single-instance | Không render UI |
| `clipboard.rs` | Wrap `clipboard-manager`, set CF_UNICODETEXT | Không format HTML |
| `tray.rs` | Tray icon, menu (Open / Settings / Exit) | Không chứa settings logic |
| `settings.rs` | Read/write `tauri-plugin-store` JSON (hotkey, startup, last_type, last_category) | Không hardcode default rải rác |
| `commands.rs` | Tauri `#[tauri::command]` expose cho frontend | Không chứa business logic, chỉ delegate |

**Layering rule**: `commands.rs` là boundary duy nhất frontend gọi vào. Các module Rust không gọi chéo绕 qua `commands.rs`.

### 5.2 TS frontend (`src/`)

| File | Trách nhiệm | Không được làm |
|---|---|---|
| `main.ts` | Entry, wire UI, state machine browse/search | Không chứa search/data logic |
| `search.ts` | **Port nguyên từ web**, FlexSearch wrapper | Không sửa thuật toán |
| `data.ts` | Load + cache `data.json`, expose `getAllItems()` | Không filter ở đây |
| `taxonomy.ts` | Load `taxonomy.json`, expose `getGroups(type)` / `getItemsByGroup(type, groupId)` | Không hardcode mapping (đọc từ file) |
| `clipboard-bridge.ts` | Wrap `invoke('copy_glyph', {text})` | Không gọi DOM |
| `state.ts` | UI state (mode browse/search, currentType, currentCategory, query, debounce timer) | Không call DOM |
| `settings-bridge.ts` | Wrap `invoke('get_settings')` / `save_settings`, cache local | Không chứa default |
| `ui/popup.ts` | Render popup root, tab/chip bar, grid | Không gọi invoke trực tiếp (qua bridge) |
| `ui/grid.ts` | Render icon grid cell, click handler | Không chứa state |
| `ui/search-bar.ts` | Render query input + filter chips | Không chứa search logic |
| `ui/empty.ts` | Render empty/error state | — |
| `styles.css` | Calm theme (ChatGPT-inspired) | Không inline style trong TS |

**Layering rule**: `ui/*` không call `invoke` trực tiếp. `search.ts` không import `ui/*`. `state.ts` là single source of truth cho UI mode. Không dùng Web Worker (FlexSearch warm index < 50ms cho 14.870 item, main thread + debounce 120ms đủ — tránh complexity).

---

## 6. API surface (Tauri commands)

```
copy_glyph(text: String): Promise<void>
  → clipboard.rs set CF_UNICODETEXT

hide_popup(): Promise<void>
  → window.rs hide (không destroy webview)

show_popup(): Promise<void>
  → window.rs show + steal focus

get_settings(): Promise<Settings>
  → settings.rs read store

save_settings(s: Settings): Promise<void>
  → settings.rs write store atomic

register_hotkey(accelerator: String): Promise<boolean>
  → hotkey.rs unregister old + register new, return success/fail rõ (KHÔNG silent fallback)
```

**Events Rust → Frontend:**

```
"hotkey-triggered"   → frontend focus search input, switch to search mode
"focus-lost"         → frontend reset query (chỉ reset query, không hide — hide do window.rs)
"settings-changed"   → frontend reload settings cache
```

---

## 7. Failure mitigation (map PRODUCT.md → architecture, updated)

| Failure | Mitigation |
|---|---|
| F1 Win+; register fail | **Revised**: ADR-05 default `Alt+;` register reliably. `Win+;` chỉ experimental option. Register fail → báo lỗi rõ trong UI, yêu cầu user chọn hotkey khác, KHÔNG silent fallback, KHÔNG tự sửa registry v1. |
| F2 cold start jank | Webview warmup ngầm khi app start (tray mode), giữ webview sống ẩn sau Esc (hide không destroy). |
| F3 search lag | **Revised**: debounce 120ms, search sync main thread (FlexSearch warm index < 50ms, không cần Web Worker), cache query trước, abort query cũ. Verify bằng `scripts/bench-search.mjs`. |
| F4 clipboard tofu | CF_UNICODETEXT only, không set HTML format, test 5 app (Telegram, Discord, Word, Notion, Obsidian). |
| F5 memory bloat | Đo thực Phase implement, nếu > 100MB idle → hide-destroy-rebuild sau 5 phút idle. |
| F6 focus steal sai | `window.rs` check foreground window trước show, nếu fullscreen → skip steal. |
| F7 multi-instance | `tauri-plugin-single-instance`. Bấm hotkey lần 2 khi popup đang show = toggle ẩn (không phải open instance mới). |
| F8 DPI | Tauri v2 tự xử per-monitor DPI, test 2 màn. |
| F9 binary phình | data.json có thể gzip + giải nén runtime nếu > 15MB (fallback). |
| F10 taxonomy sai | **Resolved**: mapping đầy đủ 93 kaomoji + 26 symbol + catch-all policy. Build script validate loud, không silent drop. |
| F11 settings persist | `tauri-plugin-store` atomic write, corruption recovery default. |
| F12 crash mất focus | `onBlur` → hide (không destroy), không crash. |
| B1 quên hotkey | Tray icon click cũng mở popup, tooltip tray ghi rõ hotkey (`Alt+;`). |
| B2 popup trắng | Browse mode mặc định hiện grid theo `last_type`/`last_category` (first run = Emoji → Smileys), không empty. |
| B3 browse sâu | Tab + chip cùng màn, grid hiện ngay, max 2 click tới icon. |
| B4 search kém | ADR-03 port nguyên search.ts, benchmark app == web. |
| B5 clipboard HTML bẩn | Chỉ CF_UNICODETEXT. |
| B6 che app | Popup 480x360, position center hoặc caret. |
| B7 nặng | Mục tiêu cứng < 15MB installer, đo Phase implement. |

---

## 8. Key trade-off

| Trade-off | Chọn | Đổi lại |
|---|---|---|
| Tốc độ popup vs RAM | Giữ webview sống | Ăn ~50MB RAM idle |
| Drift = 0 vs performance | Port nguyên search.ts | Phụ thuộc webview sống |
| Hotkey an toàn vs đúng mental model | `Alt+;` (register reliably) | User học shortcut mới, không thay emoji panel MS |
| Browse nhớ last vs cố định | Nhớ last (data kaomoji+symbol nhiều hơn emoji) | Có thể surprise nếu user quên lần trước (mitigate: highlight tab active rõ) |
| No Recents vs state continuity | No Recents (user chốt) | Mỗi mở popup = query trắng, browse category continuity bù |
| Build-time taxonomy vs runtime | Build-time Python script | Phải rebuild khi data update |
| Single calm theme vs toggle | 1 theme cố định v1 | User không custom |
| Main thread search vs Web Worker | Main thread + debounce (đã đủ < 50ms) | Nếu future data phình > 50k item, có thể cần worker |

---

Spec sẵn sàng gate review lần cuối. Tất cả open questions đã chốt với user (tên, hotkey, browse). Stack + module + data model + failure mitigation ổn.
