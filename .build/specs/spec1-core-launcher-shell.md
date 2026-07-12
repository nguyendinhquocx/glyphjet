# Spec 1 — Core Launcher Shell

Ngày: 2026-07-12
Phase: 5 (Spec Handoff) — Spec 1/3
Status: Draft, chờ user review

Covers ROADMAP: F1 (hotkey) + F2 (window) + F8 (Esc) + F11 (single instance)

---

## Context Snapshot

**Project**: GlyphJet — Windows spotlight launcher cho emoji/symbol/kaomoji.
**Path**: `D:\pcloud\workspace\code\window\glyphjet`
**Stack**: Rust + Tauri v2 (shell), TypeScript + Vite (frontend WebView2).
**Current state**: Phase 3 đã scaffold codebase, cargo check + tsc + vitest + vite build đều PASS. Rust shell có lib.rs setup plugins + default hotkey register, window.rs có show/hide helpers, main.ts có Esc listener. Nhưng chưa test runtime thực tế (popup chưa từng hiện ra).

**Desired state**: Bấm `Alt+;` → popup spotlight hiện (480x360, borderless, transparent, always-on-top, skip taskbar) → focus steal để gõ ngay. Bấm `Alt+;` lần nữa hoặc Esc → popup ẩn (giữ webview sống). Nếu app chạy 2 instance → instance 2 toggle popup instance 1 rồi exit.

**Relevant files**:
- `.build/ARCHITECTURE.md` (ADR-05 hotkey policy)
- `.build/ROADMAP.md` (F1/F2/F8/F11)
- `src-tauri/src/lib.rs` (plugin setup, hotkey handler)
- `src-tauri/src/window.rs` (show/hide helpers)
- `src-tauri/tauri.conf.json` (spotlight window config)
- `src-tauri/capabilities/default.json` (window permissions)
- `src/main.ts` (Esc listener)

**Constraints**: Windows 11, không auto-paste, không silent fallback hotkey, no telemetry.

---

## Objective

Khi user bấm `Alt+;` ở bất kỳ app nào trên Windows 11, popup GlyphJet hiện ra trong < 150ms, focus vào search input. Bấm `Alt+;` lần nữa hoặc `Esc` → popup ẩn, focus trả về app trước. Nếu cố chạy 2 process GlyphJet, instance thứ 2 chỉ toggle popup instance 1 rồi tự thoát — không bao giờ có 2 popup cùng lúc.

Lý do: Đây là cốt lõi của "spotlight launcher". Nếu phím tắt không mở được popup, toàn bộ app vô dụng. Phải deterministic, không fail silent như rủi ro Win+; ban đầu (ARCHITECTURE ADR-05).

---

## Scope

**Trong scope:**
- Register `Alt+;` global shortcut, verify register thành công (nếu fail, log + tray notification).
- Toggle popup show/hide khi bấm hotkey.
- Window spotlight: borderless, transparent, always-on-top, skip taskbar, center, 480x360.
- Focus steal khi show (user gõ ngay được).
- Esc key → hide popup (frontend listener, gọi `hide_popup` command).
- Click ngoài popup (window blur) → hide popup.
- Single instance: instance 2 → toggle popup instance 1 + exit.

**Ngoài scope (defer sang spec khác hoặc v1.1):**
- Search/browse/copy UX (spec 2).
- Tray icon menu (spec 3).
- Settings UI + persist (spec 3).
- Win+; experimental option (P2, F13).
- Fullscreen app detect skip focus steal (P2, F16).
- Window position caret mode (F12 caret variant defer).

---

## Assumptions

1. `Alt+;` register được reliably trên Windows 11 qua `tauri-plugin-global-shortcut` (RegisterHotKey Win32). Nếu conflict với app khác, register trả error → log.
2. WebView2 runtime có sẵn trên Windows 11 (bundle default).
3. Window config `spotlight` trong tauri.conf.json đã đúng (borderless/transparent/alwaysOnTop/skipTaskbar/visible=false/center).
4. `tauri-plugin-single-instance` callback nhận args từ instance 2, có thể call `get_webview_window("spotlight")` của instance 1.
5. Frontend `tauri://focus` event fire khi window được focus → dùng để focus search input.

**Open questions:**
- Q1: Window blur có reliable trên Tauri v2 không? Nếu blur fire khi click vào chính popup (vd click grid cell) → bug ẩn popup giữa thao tác. Cần test, có thể phải ignore blur nếu target trong popup.
- Q2: Tauri v2 có support `set_skip_taskbar` runtime không, hay chỉ config-time? (Config đã có skipTaskbar=true).

---

## Technical approach

**Hotkey register**: Dùng `tauri-plugin-global-shortcut::Builder::with_shortcut("Alt+;")` setup ở `lib.rs::run()`. Handler check `window.is_visible()` → toggle show/hide. Đã scaffold, cần verify runtime.

**Window lifecycle**: `window::show()` = `window.show() + set_focus() + center()`. `window::hide()` = `window.hide()`. Webview giữ sống (không destroy) để lần mở sau < 150ms. Borderless/transparent/alwaysOnTop/center từ tauri.conf.json.

**Focus steal**: `set_focus()` khi show. Frontend listen `tauri://focus` → focus search input. Nếu foreground window là fullscreen game → Tauri có thể không steal được, defer skip logic (F16).

**Esc handler**: Frontend `document.addEventListener('keydown', e => if e.key === 'Escape' invoke('hide_popup'))`. Đã scaffold trong main.ts.

**Blur → hide**: Listen `tauri://blur` event (hoặc window.onBlur). Nếu reliable và không bug khi click trong popup → hide. Nếu bug → defer, chỉ Esc + hotkey toggle hide.

**Single instance**: `tauri-plugin-single-instance::init(callback)` đã setup trong lib.rs. Callback của instance 2 → `get_webview_window("spotlight")` instance 1 → show. Instance 2 tự exit (plugin lo).

**Risk chính**:
- Hotkey register fail silent → user bấm không mở gì. Mitigation: log error rõ + tray notification (spec 3). Phase này nếu fail thì test lại manual.
- Focus steal không work với UWP fullscreen → popup hiện nhưng user không thấy. Defer F16.
- Blur ẩn popup giữa thao tác click → UX tồi. Phải test, có thể ignore blur.

---

## Ordered tasks

**T1. Verify hotkey register runtime + log error nếu fail**
- Files: `src-tauri/src/lib.rs`
- Đổi setup để bắt error register, log via `eprintln!` + tray notification placeholder
- Acceptance: chạy `pnpm tauri dev`, bấm Alt+; → console log "hotkey registered" hoặc "register failed: <reason>"
- Verify: terminal log rõ ràng

**T2. Verify toggle show/hide khi bấm hotkey**
- Files: `src-tauri/src/lib.rs` (handler đã có)
- Acceptance: bấm Alt+; → popup hiện, bấm nữa → ẩn, bấm lại → hiện
- Verify: manual test 5 lần toggle

**T3. Verify focus steal khi show**
- Files: `src-tauri/src/window.rs`, `src/main.ts` (focus listener)
- Acceptance: popup hiện → search input có focus ngay (cursor nhấp nháy ở input)
- Verify: mở Notepad, bấm Alt+;, gõ vài ký tự → ký tự vào search input GlyphJet chứ không vào Notepad

**T4. Esc handler**
- Files: `src/main.ts` (đã có scaffold)
- Acceptance: mở popup, bấm Esc → popup ẩn
- Verify: manual

**T5. Window blur → hide (cẩn thận click-within)**
- Files: `src-tauri/src/lib.rs` (listen blur event) hoặc `src/main.ts` (frontend)
- Acceptance: click sang app khác → popup ẩn. Click vào grid cell trong popup → KHÔNG ẩn (chỉ copy)
- Verify: mở popup, click Telegram window → popup ẩn. Mở popup, click icon cell → popup vẫn mở
- Note: nếu blur bug khi click trong popup → defer sang spec 3 hoặc v1.1, chỉ giữ Esc + hotkey

**T6. Single instance verify**
- Files: `src-tauri/src/lib.rs` (đã setup)
- Acceptance: chạy `pnpm tauri dev` (instance 1), chạy `cargo run` lần 2 trong src-tauri (instance 2) → instance 2 toggle popup instance 1 rồi exit
- Verify: terminal instance 2 exit code 0, popup instance 1 toggle

**T7. Window visual verify (borderless/transparent/always-on-top/center)**
- Files: `src-tauri/tauri.conf.json` (config đã có)
- Acceptance: popup hiện → không có title bar, không có taskbar entry, luôn trên top app khác, căn giữa màn
- Verify: screenshot popup, check visual

---

## Acceptance + Verify per task

| Task | Acceptance | Verify command/step |
|---|---|---|
| T1 | Console log register status | `pnpm tauri dev`, check terminal |
| T2 | Toggle show/hide 5 lần | Manual bấm Alt+; |
| T3 | Search input focus sau show | Mở Notepad, bấm Alt+;, gõ "test" → vào GlyphJet input |
| T4 | Esc ẩn popup | Manual |
| T5 | Blur ẩn popup, click trong popup không ẩn | Manual click test |
| T6 | Instance 2 toggle instance 1 | Chạy 2 process |
| T7 | Popup borderless/transparent/top/center | Screenshot + visual check |

**Final verify Spec 1**: `pnpm tauri dev` → app chạy → Alt+; toggle popup work → Esc hide work → single instance work → window visual đúng.

---

## User Test checklist

Sau khi implement Spec 1, user test:

1. **Hotkey cơ bản**: Mở app (`pnpm tauri dev` hoặc build installer). Mở Telegram/Notepad bất kỳ. Bấm `Alt+;`. Popup GlyphJet phải hiện ra trong < 1 giây, căn giữa màn, không có title bar, không có icon taskbar.
2. **Toggle**: Bấm `Alt+;` lần nữa. Popup ẩn. Bấm lại. Popup hiện. Lặp 3 lần — phải mượt, không lag.
3. **Focus**: Popup hiện. Gõ "abc" ngay không cần click. "abc" phải vào ô search GlyphJet (placeholder "Search glyphs…"), không vào app sau lưng.
4. **Esc**: Popup đang hiện. Bấm Esc. Popup ẩn. Focus trả về app trước (vd Telegram — gõ "abc" vào Telegram được).
5. **Click ngoài**: Popup đang hiện. Click sang Telegram window. Popup phải ẩn.
6. **Click trong popup**: Popup hiện. Click vào bất kỳ icon nào trong grid (chưa cần copy work, chỉ test click). Popup KHÔNG được ẩn giữa chừng.
7. **Single instance**: Nếu biết cách chạy 2 process, chạy instance 2 → popup instance 1 phải toggle (hiện nếu đang ẩn, ẩn nếu đang hiện), instance 2 tự thoát. Nếu khó test thì skip, AI verify.

---

## External Review Brief

Reviewer (agent khác, session mới) cần phán:

1. **Hotkey policy đúng chưa**: Default `Alt+;` có register reliably qua `RegisterHotKey` Win32 không? Có edge case nào silent fail? Read `.build/ARCHITECTURE.md` ADR-05 + `src-tauri/src/lib.rs`.
2. **Window lifecycle đúng chưa**: Show/hide giữ webview sống có đúng architecture không? Borderless/transparent/alwaysOnTop config có thiếu gì cho Win11? Read `src-tauri/tauri.conf.json` window "spotlight" + `src-tauri/src/window.rs`.
3. **Blur handler risk**: Click trong popup có trigger window blur không (bug ẩn giữa chừng)? Nếu có, mitigation đúng chưa? Đây là risk cao nhất Spec 1.
4. **Single instance**: `tauri-plugin-single-instance` callback có reliably call `get_webview_window` instance 1 không? Có race condition?
5. **Verify plan đủ chưa**: 7 task verify có bắt đủ lỗi không? Thiếu edge case nào (vd Alt+; khi popup đang hide nhưng webview đang GC)?

**Files reviewer nên đọc trước**:
- `.build/ARCHITECTURE.md` (ADR-05, F1/F2 section)
- `.build/ROADMAP.md` (F1/F2/F8/F11)
- `src-tauri/src/lib.rs`
- `src-tauri/src/window.rs`
- `src-tauri/tauri.conf.json`
- `src/main.ts`

**Decision cần soi kỹ**: Blur → hide có an toàn không, hay phải defer.

---

## Implementation Handoff

Solo (parent tự implement). Không delegate worker. Lý do: task runtime-test-heavy, cần iterate nhanh với `pnpm tauri dev`, không phải task atomic rõ ràng cho worker context rỗng.
