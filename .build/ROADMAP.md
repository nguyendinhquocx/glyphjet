# ROADMAP.md — GlyphJet

Ngày: 2026-07-12
Phase: 4 (Feature Breakdown) — [GATE, chờ user duyệt]

Tham chiếu: PRODUCT.md (failure modes), ARCHITECTURE.md (5 ADR + module), STRUCTURE.md (folder).

---

## Priority definitions

- **P0** — không có là vỡ. MVP launcher không chạy được nếu thiếu.
- **P1** — quan trọng, trải nghiệm dùng tốt. Nên có trong v1 release.
- **P2** — nice-to-have, polish. Có thể defer sang v1.1.

---

## Feature list

### P0 — MVP phải có

**F1. Global hotkey toggle popup**
- Register `Alt+;` default via `tauri-plugin-global-shortcut`.
- Toggle: nếu popup visible → hide, ngược lại → show.
- Scope: `hotkey.rs` + `lib.rs` setup. Đã scaffold logic, cần test thực tế register.
- Verify: bấm Alt+; → popup hiện, bấm nữa → ẩn.

**F2. Spotlight window lifecycle**
- Show/hide `spotlight` window (borderless, transparent, always-on-top, skip taskbar).
- Focus steal khi show (cho user gõ ngay).
- Hide khi Esc hoặc click ngoài (onBlur).
- Scope: `window.rs` + `tauri.conf.json` window config.
- Verify: popup hiện exact 480x360, không có taskbar entry, luôn trên top.

**F3. Copy glyph to clipboard**
- Click icon cell → write `item.t` to clipboard via `clipboard-manager`.
- CF_UNICODETEXT only, không HTML.
- Popup giữ mở sau copy (không auto-hide).
- Scope: `commands.rs::copy_glyph` + `clipboard.rs` + `grid.ts` click handler + `clipboard-bridge.ts`.
- Verify: copy 🐻 → paste vào Telegram/Discord/Word ra 🐻 đúng.

**F4. Search engine port + search UI**
- Init FlexSearch với 14.870 item (1 lần khi popup first open hoặc app start).
- Query input → debounce 120ms → search → results grid.
- Filter All/Emoji/Symbols/Kaomoji.
- Exact-glyph paste path (gõ → ra →).
- Scope: `search.ts` (port từ web) + `main.ts::onQuery` + `ui/search-bar.ts` + `ui/grid.ts`.
- Verify: gõ "bear" ra 🐻 + ʕ•ᴥ•ʔ; gõ "→" ra →; gõ "love" ra ♥.

**F5. Browse mode (tabs + chips + grid)**
- 3 tab Emoji/Symbols/Kaomoji.
- Sub-category chips scroll ngang theo taxonomy (9+11+15=35 nhóm).
- Grid icon theo type+group, alphabetical sort.
- Scope: `taxonomy.ts` + `ui/tab-bar.ts` + `ui/chip-bar.ts` + `ui/grid.ts` + `data.ts::getItemsByCategory`.
- Verify: Emoji → Smileys thấy 😀😁😂; Kaomoji → Animals thấy ʕ•ᴥ•ʔ.

**F6. Data + taxonomy load**
- Bundle `data.json` (14.870 item) + `taxonomy.json` (35 nhóm) trong frontend.
- Cache in-memory sau lần load đầu.
- Scope: `data.ts` + `taxonomy.ts` + `scripts/build_taxonomy.py`.
- Verify: getItemCount() = 14870, getGroups("kaomoji").length = 15.

**F7. Tray icon + menu**
- System tray icon với menu: Open / Settings / Exit.
- Click tray icon = toggle popup.
- Tooltip tray ghi "GlyphJet — Alt+;".
- Scope: `tray.rs`.
- Verify: tray icon xuất hiện, click Open → popup hiện, click Exit → app thoát.

**F8. Esc to close + cleanup**
- Esc key → hide popup (giữ webview sống).
- Backspace rỗng trong search → KHÔNG close (chỉ stay), không ngu như Android bug trước.
- Scope: `main.ts` keydown listener.
- Verify: mở popup, gõ Esc → ẩn. Search rỗng bấm Backspace → không xảy ra gì, vẫn ở browse.

### P1 — important for v1

**F9. Settings persist**
- `tauri-plugin-store` JSON: hotkey, launch_on_startup, popup_position, last_type, last_category.
- Atomic write.
- Corruption recovery → default.
- Scope: `settings.rs` + `settings-bridge.ts`.
- Verify: đổi hotkey → restart app → hotkey mới còn.

**F10. Browse state continuity**
- Khi user đổi type/category → save last_type + last_category.
- Mở popup lại → restore last state (validate, fallback Emoji/Smileys).
- Query luôn reset rỗng mỗi lần mở.
- Scope: `settings-bridge.ts::saveBrowseState` + `main.ts::init` restore logic.
- Verify: mở Symbols → Math, đóng, mở lại → thấy Symbols → Math.

**F11. Single instance guard**
- `tauri-plugin-single-instance`: instance 2 → show popup instance 1 + exit.
- Scope: `lib.rs` setup.
- Verify: chạy 2 process, process 2 tự show popup process 1 rồi thoát.

**F12. Window position policy**
- Default center. Option caret (gần text cursor) — cần JNI/Win32 API, defer nếu phức tạp.
- Scope: `window.rs::show` + settings.popup_position.
- Verify: popup hiện center màn hình.

### P2 — polish / defer

**F13. Win+; experimental option**
- Settings toggle "Try Win+; (experimental)".
- Nếu register fail → báo lỗi rõ, KHÔNG silent fallback.
- Scope: `hotkey.rs::register` + Settings UI.
- Defer: chỉ nếu user muốn thử cướp Microsoft sau khi v1 ổn.

**F14. Visual "copied" feedback**
- Click icon → cell highlight "copied" 0.8s.
- Scope: `main.ts::flashCopied` + `grid.ts` + CSS.
- Defer:Phase 5 polish.

**F15. Launch on startup**
- Register app với Windows startup (registry Run key hoặc Startup folder shortcut).
- Scope: setup script hoặc `tauri-plugin-autostart`.
- Defer: v1.1.

**F16. Fullscreen app detect**
- Trước show popup, check foreground window có fullscreen không → skip focus steal.
- Scope: `window.rs` Win32 `GetForegroundWindow` + `GetWindowRect`.
- Defer: edge case, test với game/video sau.

**F17. Keyboard navigation**
- Arrow keys navigate grid cells, Enter copy selected.
- Scope: `main.ts` + `grid.ts`.
- Defer: Phase 5 polish.

**F18. Bundle size optimization**
- Lazy load data.json (dynamic import) thay vì bundle → giảm initial 1.9MB.
- Hoặc gzip data + giải nén runtime.
- Scope: `data.ts` + vite manualChunks.
- Defer: nếu startup > 150ms thực tế thì làm.

---

## Dependency graph

```
F6 (data+taxonomy load)
 ├── F4 (search engine)
 │    └── F5 (browse mode) — share grid component
 ├── F3 (copy glyph) — needs items
 │
F1 (hotkey) → F2 (window lifecycle) → F8 (Esc)
                                        │
F7 (tray) ──────────────────────────────┤
                                        │
F9 (settings persist) ←── F10 (browse state)
       │
F11 (single instance)  F12 (position)
```

**Thứ tự implement:**
1. F6 → F4 → F5 (core search + browse)
2. F1 → F2 → F8 (hotkey + window + Esc)
3. F3 (copy)
4. F7 (tray)
5. F9 → F10 (settings + state)
6. F11, F12 (single instance, position)
7. P2 polish theo thứ tự F14, F13, F15, F16, F17, F18

---

## Spec plan (Phase 5)

Mỗi P0 feature = 1 spec file trong `.build/specs/`:
- `specs/f1-hotkey.md`
- `specs/f2-window.md`
- `specs/f3-copy.md`
- `specs/f4-search.md`
- `specs/f5-browse.md`
- `specs/f6-data-load.md`
- `specs/f7-tray.md`
- `specs/f8-esc-cleanup.md`

P1/P2 feature = gộp vào spec nếu nhỏ, hoặc spec riêng nếu phức tạp.

Implement tuần tự theo dependency graph. Mỗi feature xong → verify → mark done → feature tiếp.

---

## Verify total

Sau tất cả P0+P1:
- `pnpm test` PASS (10 tests hiện tại + thêm test cho mỗi feature)
- `pnpm build` PASS (production bundle < 15MB)
- `cargo check` + `cargo build --release` PASS
- Manual smoke: bấm Alt+; → popup hiện < 150ms → gõ "bear" → 🐻 → click → paste vào Notes = 🐻
- Manual smoke: browse Kaomoji → Animals → ʕ•ᴥ•ʔ → copy → paste Telegram OK
- Manual smoke: Esc → popup ẩn, focus về app cũ
- Manual smoke: tray Open → popup hiện, tray Exit → app thoát sạch
