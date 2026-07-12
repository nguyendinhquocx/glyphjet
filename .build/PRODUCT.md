# PRODUCT.md — GlyphJet

Ngày: 2026-07-12 (updated sau ChatGPT advice + GLM review)
Phase: 1 (Problem Analysis) — revised
Trạng thái: v1 chốt

---

## Tên sản phẩm

**GlyphJet** — instant emoji, symbols and kaomoji.

- Folder / repo: `glyphjet`
- Executable: `GlyphJet.exe`
- Package id: `com.quoc.glyphjet`

Lý do chọn (xem ARCHITECTURE ADR-01): "glyph" đúng abstraction (bao trùm emoji, Unicode symbol, kaomoji), "Jet" truyền tốc độ (< 150ms open). Tránh "Icon Windows" (nghe như thư mục .ico, sai semantic, khó sở hữu identity).

## Vấn đề

Trên Windows 11, khi đang gõ chat (Telegram, Discord, Zalo) hoặc viết doc (Word, Notion, Obsidian), user muốn ném nhanh một emoji / symbol / kaomoji vào editor đang focus. Microsoft Emoji Panel (Win+; / Win+.) tồn tại và hỗ trợ cả emoji, GIF, kaomoji lẫn symbol, nhưng:

- **Catalog nông + không tận dụng được kho sâu**: panel Microsoft chỉ có vài trăm kaomoji và symbol curation mỏng, trong khi data đã thu thập 14.870 item (9.884 kaomoji, 3.091 symbol, 1.895 emoji) với category chi tiết.
- **Search synonym / ranking kém**: gõ "love" không ưu tiên ♥, gõ "arrow" không ra → theo rank, gõ "bear hug" không nhận alias. Web `icon.quoc.app` đã có FlexSearch + alias map (heart→love, kitty→cat...) + exact-glyph path O(1) + quality ranking (penalty kaomoji rác, emoji tone modifier) + typo-light fallback — panel Microsoft không có.
- **Thao tác launcher chậm**: phải mở panel → click category → scroll, không có flow "bấm hotkey → gõ 3 ký tự → Enter → paste".
- **Ba loại tách rời**: emoji, kaomoji, symbol nằm 3 tab riêng, không có unified search surface xuyên suốt.

Giải pháp: GlyphJet — spotlight launcher toàn cục, bấm hotkey → popup hiện → browse category hoặc gõ search → copy glyph → paste tiếp. Tận dụng 100% data + search engine đã có của web, gộp 3 loại vào 1 search surface, ưu tiên tốc độ (launcher vibe) thay vì panel browse lướt.

## Tại sao đáng làm

- Data + search algorithm đã tồn tại (mấy tuần đầu tư), chỉ cần bọc native shell.
- Khác biệt thật với Microsoft Emoji Panel: **catalog sâu hơn 10x** (14.870 vs vài trăm), **search synonym/ranking tốt hơn** (FlexSearch + alias + quality score), **thao tác launcher nhanh hơn** (hotkey → search → paste < 3s), **gộp 3 loại vào 1 search surface** thay vì 3 tab riêng.
- Không phải thay emoji panel của Microsoft (không cướp Win+; được reliably — xem ARCHITECTURE ADR-05), mà là utility riêng với hotkey độc lập (Alt+; default).
- Focus utility cá nhân, một việc chính, tốc độ là feature.

## Người dùng

**Primary (v1)**: Quoc — power user, gõ nhiều chat + doc, cần icon nhanh, không rời bàn phím, ghét app nặng.

Không có secondary user trong v1. Có thể share public sau (v2), nhưng v1 là personal tool, không cần auth/onboarding/multi-user.

## Outcome mong muốn (success trông như thế nào)

- Bấm `Win+;` → popup hiện trong < 150ms kể từ phím.
- Gõ `bear` → thấy 🐻 + ʕ•ᴥ•ʔ + 🐻‍❄️ trong < 50ms kể từ ký tự cuối.
- Click icon hoặc Tab/Enter → glyph trong clipboard, focus giữ nguyên tại app đích để paste liền.
- Browse tab `Emoji / Symbols / Kaomoji` → category nhóm sạch, click grid, copy.
- Esc hoặc X → đóng popup, focus trả về app cũ.
- App idle < 60MB RAM, CPU 0%, không leak.
- Binary installer < 15MB.
- Hoạt động offline 100% sau lần cài đầu (data bundle trong app).

## Ràng buộc

- Windows 11 (primary). Windows 10 nice-to-have nhưng không bắt buộc v1.
- Local-first: không network runtime (trừ update data manual replace file).
- Không auth, không account, không telemetry.
- Reuse `data.json` + `search.ts` từ web project `D:\pcloud\workspace\code\website\icon\`.
- Stack: Tauri v2 (đã chốt ở brainstorming).
- Single user, single instance (không mở nhiều popup cùng lúc).
- 1 theme calm cố định v1, không dark/light toggle.

## Non-goals v1 (cố tình KHÔNG làm)

- Auto-paste vào app đích sau copy (nguy cơ can thiệp InputMethod, sai cửa sổ).
- Recents / history (user chốt bỏ — mỗi lần mở popup là trắng tinh, browse + search bù).
- Cloud sync settings hay data.
- Custom icon upload / user data.
- Multi-platform (Mac, Linux).
- AI suggest icon.
- Online data update (versioning, OTA).
- Theme custom, dark/light toggle.
- Icon preview lớn / detail panel (click = copy luôn, không preview step).
- Snippet Expansion kiểu Espanso (không gõ tắt thay thế text).
- Onboarding flow, tutorial, first-run wizard.
- Multi-language UI (English-only UI v1, data icon giữ nguyên).

---

## Failure modes (first — làm ngược từ thảm hoạ)

### Kỹ thuật

**F1. Hotkey Win+; register fail**
Microsoft `TextInputHost.exe` hook Win+; ở mức thấp để mở emoji panel hệ thống. `RegisterHotKey` Win32 thông thường của Tauri có thể không cướp được.
- Hậu quả: app cài xong nhưng bấm Win+; không mở gì, hoặc vẫn mở emoji Microsoft.
- Mitigation: detect register fail lúc khởi động → guide user tắt emoji panel Microsoft (registry / Settings) hoặc đề xuất hotkey thay thế (Win+., Alt+;, Ctrl+Space).

**F2. Popup xuất hiện trễ (cold start jank)**
Lần đầu bấm hotkey sau boot máy, webview phải spin up + load 1.9MB data.json + build FlexSearch index → có thể > 300ms.
- Hậu quả: user bấm Win+; không thấy gì, bấm lại, popup hiện hai lần hoặc user tưởng treo.
- Mitigation: warmup webview ngầm khi app start (tray), giữ webview sống sau khi Esc (ẩn chứ không destroy), chỉ build index 1 lần.

**F3. Search lag trên máy yếu**
14.870 item, FlexSearch forward index, gõ mỗi ký tự trigger search. Trên CPU yếu hoặc khi webview đang GC, có thể jitter.
- Hậu quả: gõ "elephant" thấy kết quả nhảy từng chữ.
- Mitigation: debounce 120ms, search sync trên main thread (FlexSearch warm index đã < 50ms cho 14.870 item, đủ nhanh — không cần Web Worker, tránh complexity), cache kết quả query trước, abort search cũ khi query mới đến. Verify thực tế bằng `scripts/bench-search.mjs` port từ web.

**F4. Clipboard copy glyph nhưng target app render hộp/tofu**
Windows clipboard có nhiều format (CF_UNICODETEXT, CF_TEXT). Một số app cũ (Notepad++, Excel 2016) đọc CF_TEXT và mất emoji. Emoji ZWJ sequence (🐻‍❄️) có thể bị split thành 2 glyph ở app không hỗ trợ.
- Hậu quả: user copy 🐻‍❄️, paste ra 🐻 + ❄️ rời, hoặc hộp tofu.
- Mitigation: luôn set CF_UNICODETEXT, test trên 5 app phổ biến (Telegram, Discord, Word, Notion, Obsidian), ghi rõ limitation trong README.

**F5. Memory bloat do webview keep-alive**
Giữ webview sống để popup mở nhanh → process ngầm ăn RAM cả ngày. Chromium webview baseline ~40-80MB.
- Hậu quả: user thấy app ăn 150MB+ trong Task Manager, tưởng leak, kill process.
- Mitigation: đo thực tế, nếu > 100MB idle thì chiến lược hybrid (giữ webview 5 phút sau lần mở cuối, rồi destroy, rebuild khi cần).

**F6. Focus steal sai cửa sổ**
Popup phải steal focus để user gõ ngay. Nhưng nếu app đích là UWP fullscreen (game, video), steal focus có thể minimise app hoặc bị chặn.
- Hậu quả: popup hiện nhưng gõ phím vẫn đi vào app cũ, hoặc app fullscreen bị kick ra desktop.
- Mitigation: detect foreground window trước khi show popup, nếu fullscreen → không steal, chỉ copy mode. Test với game/video.

**F7. Multiple instance khi user bấm hotkey liên tục**
User bấm Win+; 3 lần nhanh → 3 popup chồng lên nhau.
- Hậu quả: focus loạn, copy sai icon.
- Mitigation: single-instance lock, nếu popup đang show thì bấm hotkey lần nữa = toggle ẩn.

**F8. DPI scaling khác nhau trên multi-monitor**
Laptop 125% + external 100%, popup hiện ở monitor nào cũng phải nét.
- Hậu quả: popup mờ/nhòe trên monitor DPI khác.
- Mitigation: Tauri v2 tự xử per-monitor DPI, nhưng test thực trên setup 2 màn.

**F9. Data.json bundle phình binary**
1.9MB JSON + webview runtime + Rust shell → installer có thể > 15MB mục tiêu.
- Hậu quả: vi phạm ràng buộc nhẹ.
- Mitigation: gzip data.json runtime (webview giải nén < 50ms), hoặc chia data theo type load lazy.

**F10. Category taxonomy sai → browse không ra icon**
93 kaomoji category thô + 26 symbol Unicode block phải gom. Nếu gom sai (vd "table-flipping" vào nhóm Wrong), user browse không thấy icon mong muốn.
- Hậu quả: user mất niềm tin vào browse, chỉ dùng search, và nếu search cũng kém → bỏ app.
- Mitigation: build-time mapping script, review mapping thủ công cho từng nhóm, test browse flow với 20 query đại diện.

**F11. Settings persist hỏng**
User đổi hotkey hoặc toggle, không lưu được (permission, path sai).
- Hậu quả: mỗi lần mở lại về default, user bực.
- Mitigation: dùng Tauri `store` plugin, lưu JSON trong app data dir, test read/write + corruption recovery.

**F12. App crash khi popup mất focus đột ngột**
User mở popup, click chuột sang app khác (không Esc), popup mất focus → event loop xử lý sai.
- Hậu quả: popup treo, hoặc ghost process.
- Mitigation: `onBlur` → auto hide (không destroy), không crash. Test force-kill foreground app khi popup mở.

### Business / UX

**B1. User không nhớ hotkey**
Cài xong, quên Win+; → app vô dụng.
- Hậu quả: app cài rồi không bao giờ mở lại.
- Mitigation: tray icon click cũng mở popup (phụ), tooltip tray ghi rõ hotkey, README ngắn hiện lần đầu.

**B2. Popup trắng tinh gây bối rối**
Không có Recents (user chốt bỏ), mở popup thấy trống (browse category vẫn hiện nhưng user có thể không nhận ra).
- Hậu quả: user bấm thử vài phím không biết, đóng, không mở lại.
- Mitigation: browse mode mặc định hiện ngay grid Emoji nhóm đầu (Smileys), không phải空白. Mở popup = thấy icon ngay, không phải nghĩ.

**B3. Browse category quá sâu → bỏ cuộc**
3 tầng (Type → Category → Grid) có thể quá nhiều click.
- Hậu quả: user muốn 🐻 nhưng phải Emoji → Animals → scroll → click.
- Mitigation: type + category cùng 1 màn (tab ngang + chip dọc/ngang), grid hiện ngay khi chọn chip, tối đa 2 click tới icon.

**B4. Search recall thấp hơn web**
User đã quen web `icon.quoc.app` gõ "love" ra ♥ liền. Nếu app search kém hơn, user mất niềm tin.
- Hậu quả: user quay lại mở browser, app chết.
- Mitigation: port nguyên `search.ts` (alias map, ranking, quality score, exact-glyph path), benchmark query đầu ra app == web.

**B5. Copy xong paste sai format**
Clipboard HTML bẩn dính `<span>` → paste vào Word ra HTML rác.
- Hậu quả: user paste vào doc thấy mã HTML, bực.
- Mitigation: chỉ set CF_UNICODETEXT thuần, không set HTML format.

**B6. Popup che app đích**
Popup spotlight căn giữa màn, che editor đang gõ → user không thấy context.
- Hậu quả: user phải Esc, paste ngoài, mất luồng.
- Mitigation: popup nhỏ (480x360), căn gần con trỏ chuột hoặc gần caret nếu lấy được, không fullscreen.

**B7. App nặng → user nghĩ bloatware**
> 50MB installer hoặc > 150MB RAM → user uninstall.
- Hậu quả: mất user trước khi kịp dùng.
- Mitigation: mục tiêu cứng installer < 15MB, RAM idle < 60MB, đo và tối ưu ở Phase implement.

---

## Cập nhật sau

- Tên sản phẩm chốt với user.
- Failure modes review lại sau Phase 2 (architecture phải mitigate hết).
