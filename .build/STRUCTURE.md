# STRUCTURE.md — GlyphJet

Ngày: 2026-07-12 (updated sau ChatGPT advice + GLM review)
Phase: 2 (Architecture) — [GATE]

Tham chiếu: ARCHITECTURE.md (module boundaries section 5).

---

## 1. Folder tree đề xuất

```
glyphjet/
├── .build/                          # build-system artifacts (không ship)
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── STRUCTURE.md
│   ├── ROADMAP.md
│   ├── PROGRESS.md
│   └── specs/                       # spec từng feature (Phase 5)
│
├── src-tauri/                       # Rust shell (native layer)
│   ├── Cargo.toml                   # dependencies, build profile
│   ├── tauri.conf.json              # Tauri config (window, bundle, plugins)
│   ├── build.rs                     # Tauri build script
│   ├── icons/                       # app icons (.ico, .png)
│   ├── resources/
│   │   ├── data.json                # 14,870 icon items (bundle trong APK)
│   │   └── taxonomy.json            # category mapping (build-time output, 93 kao + 26 sym + 9 emoji)
│   └── src/
│       ├── main.rs                  # entry, init Tauri builder + plugins
│       ├── hotkey.rs                # register/unregister global shortcut (Alt+; default)
│       ├── window.rs                # spotlight window show/hide/position/focus
│       ├── clipboard.rs             # wrap clipboard-manager, CF_UNICODETEXT
│       ├── tray.rs                  # system tray icon + menu
│       ├── settings.rs              # tauri-plugin-store read/write (hotkey, startup, last_type, last_category)
│       └── commands.rs              # #[tauri::command] expose cho frontend
│
├── src/                             # TypeScript frontend (WebView2)
│   ├── main.ts                      # entry, wire UI, state machine browse/search
│   ├── search.ts                    # PORT NGUYÊN từ web (FlexSearch + alias)
│   ├── data.ts                      # load + cache data.json
│   ├── taxonomy.ts                  # load taxonomy.json, query group/items
│   ├── clipboard-bridge.ts          # wrap invoke('copy_glyph')
│   ├── settings-bridge.ts           # wrap invoke('get_settings')/save_settings, cache local
│   ├── state.ts                     # UI state (mode, type, category, query, debounce)
│   ├── types.ts                     # IconItem (có cp?), Settings, Group TypeScript types
│   ├── ui/
│   │   ├── popup.ts                 # popup root render
│   │   ├── tab-bar.ts               # Emoji / Symbols / Kaomoji tabs
│   │   ├── chip-bar.ts              # sub-category chips (scroll ngang)
│   │   ├── grid.ts                  # icon grid cells + click
│   │   ├── search-bar.ts            # query input + filter chips
│   │   └── empty.ts                 # empty/error/loading state
│   ├── styles.css                   # calm theme (ChatGPT-inspired)
│   └── index.html                   # popup HTML root
│
├── scripts/                         # build-time tooling
│   ├── build_taxonomy.py            # gộp category thô → taxonomy.json + validate catch-all
│   ├── sync_data.py                 # copy data.json từ web project + verify count
│   └── bench-search.mjs             # benchmark search (port từ web)
│
├── tests/                           # test (Vitest cho TS, cargo test cho Rust)
│   ├── search.test.ts               # test port search.ts không drift vs web
│   ├── taxonomy.test.ts             # test mapping cover 93+26+9 = 128 category
│   └── clipboard_integration.md     # manual test checklist 5 app
│
├── .gitignore
├── .editorconfig
├── package.json                     # pnpm, vite, vitest, typescript
├── tsconfig.json
├── vite.config.ts
├── README.md
└── LICENSE                          # MIT hoặc private
```

---

## 2. Module ownership

### 2.1 Quy tắc import (KHÔNG vi phạm)

```
Frontend layering (TS):

  ui/*  ───►  state.ts  ───►  search.ts / data.ts / taxonomy.ts
   │            │
   │            ▼
   └──────►  clipboard-bridge.ts  ───►  invoke()  ───►  Rust commands.rs

QUY TẮC CỨNG:
  - ui/* KHÔNG được import { invoke } trực tiếp. Phải qua clipboard-bridge.ts.
  - search.ts KHÔNG được import ui/* hay state.ts (pure logic).
  - state.ts là single source of truth cho UI mode, không để UI tự giữ state rời.
  - data.ts / taxonomy.ts không call invoke (chỉ load resource bundle).

Rust layering:

  commands.rs  ◄───  frontend (invoke)
      │
      ├──►  window.rs
      ├──►  clipboard.rs
      ├──►  settings.rs
      ├──►  hotkey.rs
      └──►  tray.rs

QUY TẮC CỨNG:
  - commands.rs là boundary duy nhất frontend gọi vào.
  - hotkey.rs / window.rs / clipboard.rs / settings.rs / tray.rs không call chéo nhau,
    phải qua commands.rs (exception: window.rs có thể listen hotkey event để show).
```

### 2.2 Ownership matrix

| Logic / Domain | Owner | Ai được sửa |
|---|---|---|
| Search algorithm (FlexSearch, alias, ranking) | `src/search.ts` | Chỉ port từ web, không tự chế |
| Catalog data | `src-tauri/resources/data.json` | Build script `scripts/sync_data.py` sync từ web |
| Category mapping | `src-tauri/resources/taxonomy.json` | Build script `scripts/build_taxonomy.py` |
| UI state machine | `src/state.ts` | Mọi UI change đi qua state |
| Clipboard write | `src-tauri/src/clipboard.rs` | Chỉ CF_UNICODETEXT |
| Window lifecycle | `src-tauri/src/window.rs` | Hide = keep webview, Destroy = full reload |
| Hotkey register | `src-tauri/src/hotkey.rs` | Default `Alt+;`, Win+; chỉ experimental, register fail báo rõ không silent fallback |
| Settings persist | `src-tauri/src/settings.rs` | Atomic write, default ở 1 chỗ, schema có `last_type` + `last_category` (browse state) |

---

## 3. File size guard

Rule: file > 300 dòng hoặc chứa > 1 trách nhiệm chính → tách.

| File | Nguy cơ phình | Tách khi |
|---|---|---|
| `src/search.ts` | Cao (port từ web 14KB ~ 400 dòng) | OK giữ nguyên vì là port 1-1, không tách |
| `src/ui/popup.ts` | Trung bình | > 300 dòng → tách render function ra `ui/render-helpers.ts` |
| `src-tauri/src/commands.rs` | Thấp (chỉ delegate) | > 200 dòng → group command theo domain |
| `src-tauri/src/window.rs` | Trung bình (focus steal, position, multi-monitor) | > 250 dòng → tách `window/position.rs`, `window/focus.rs` |
| `scripts/build_taxonomy.py` | Trung bình (mapping dict lớn) | > 250 dòng → tách mapping ra `scripts/taxonomy_data.py` |

`src/search.ts` là exception: port nguyên từ web, không tách dù > 300 dòng, vì tách sẽ drift với web source.

---

## 4. Naming convention

| Loại | Convention | Ví dụ |
|---|---|---|
| File TS | `kebab-case.ts` cho ui module, `lower.ts` cho core | `search-bar.ts`, `search.ts` |
| File Rust | `snake_case.rs` | `hotkey.rs`, `commands.rs` |
| File Python script | `snake_case.py` | `build_taxonomy.py` |
| Type / Interface TS | `PascalCase` | `IconItem`, `Settings` |
| Function TS | `camelCase` | `copyGlyph`, `getGroups` |
| Function Rust | `snake_case` | `copy_glyph`, `show_popup` |
| Tauri command | `snake_case` (gọi bằng string) | `invoke('copy_glyph')` |
| CSS class | `kebab-case`, prefix `i-` (icon launcher) | `i-popup`, `i-grid-cell` |
| Constant | `UPPER_SNAKE` | `MAX_QUERY_LENGTH`, `DEBOUNCE_MS` |
| Build artifact | `.build/` prefix chấm | `.build/PRODUCT.md` |

---

## 5. Growth path (v2+ mở rộng vào đâu)

| Feature v2+ | Mở rộng vào | KHÔNG nhét vào |
|---|---|---|
| Dark/light theme toggle | `src/styles.css` + `src/state.ts` thêm `theme` | `ui/popup.ts` |
| Recents / history | `src-tauri/src/recents.rs` (mới) + `settings.rs` migrate store | `commands.rs` |
| Custom icon upload | `src-tauri/src/userdata.rs` (mới) + `src/data.ts` merge source | `search.ts` |
| Multi-language UI (i18n) | `src/i18n/` (folder mới) | Hardcode string rải rác |
| Online data update | `src-tauri/src/updater.rs` (mới) + verify checksum | `data.ts` |
| AI suggest icon | `src/ai-suggest.ts` (mới) + opt-in | `search.ts` (search thuần) |
| Mac/Linux port | `src-tauri/tauri.conf.json` multi-target + `src-tauri/src/platform/` | `window.rs` напрямую |
| Snippet expansion | `src-tauri/src/snippet/` (module mới, service nền) | `commands.rs` |

**Rule**: feature mới = file/folder mới, không nhét vào file core hiện có. `search.ts` giữ thuần search, `commands.rs` giữ thuần delegate.

---

## 6. Forbidden structure

KHÔNG được làm:

1. **`app.ts` god file**: 1 file chứa UI + state + search + clipboard + invoke. Mỗi trách nhiệm 1 file.
2. **`utils.ts` bãi rác**: không tạo file `utils.ts` / `helpers.ts` / `common.ts` chứa mọi thứ lộn xộn. Function vào file sở hữu logic đó.
3. **`components/` bãi rác không phân domain**: không tạo `components/Button.tsx`, `components/Header.tsx` rời rạc. UI theo domain: `ui/popup.ts`, `ui/grid.ts`.
4. **Inline style trong TS**: style trong `styles.css`, không `element.style.background = ...` rải rác.
5. **Hardcode taxonomy trong code**: mapping category phải ở `taxonomy.json`, không hardcode dict trong `taxonomy.ts`.
6. **Hardcode string trong UI**: string qua `i18n/` (v2) hoặc biến `const` ở đầu file, không rải `"...".text` trong logic.
7. **`commands.rs` chứa business logic**: command chỉ parse args + delegate, không chứa if/else business.
8. **`search.ts` bị sửa thuật toán**: đây là port 1-1 từ web, sửa ở web rồi sync, không sửa locally.
9. **`data.json` sửa tay**: data sync từ web qua script, không edit local.
10. **Global mutable state rải rác**: state tập trung `state.ts` (frontend) + `settings.rs` (backend), không để mỗi UI component tự giữ state.

---

## 7. Dependency forecast (Phase 3 bootstrap)

### Rust (`Cargo.toml`)

```
tauri = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-store = "2"
tauri-plugin-single-instance = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### TypeScript (`package.json`)

```
@tauri-apps/api (invoke, event listen)
@tauri-apps/plugin-global-shortcut
@tauri-apps/plugin-clipboard-manager
@tauri-apps/plugin-store
flexsearch (port search.ts dependency)
vite
typescript
vitest (test)
```

Không React, không Tailwind, không shadcn, không framework CSS, không Web Worker v1.

---

## 8. Verify Phase 2 hoàn thành (revised)

- [x] Folder tree đủ chi tiết cấp 1-3 (renamed `glyphjet`)
- [x] Module ownership matrix rõ + thêm `settings-bridge.ts` TS
- [x] File size guard có rule cụ thể + exception
- [x] Layering rule vẽ arrow rõ ràng + note không Web Worker
- [x] Naming convention bảng đầy đủ
- [x] Growth path 8 feature v2+ có chỗ mở rộng
- [x] Forbidden structure 10 quy tắc
- [x] Dependency forecast (Rust + TS)
- [x] Settings schema có `last_type` + `last_category` (browse state continuity)
- [x] Hotkey policy rõ: Alt+; default, Win+; experimental, không silent fallback

Sẵn sàng gate review với user (lần cuối sau revise).
