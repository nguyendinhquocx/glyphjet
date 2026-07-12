# GlyphJet

> GlyphJet — instant emoji, symbols and kaomoji.

A Windows spotlight launcher for emoji, Unicode symbols, and kaomoji. Press a global hotkey, browse categories or search, copy a glyph, paste into any app.

## What it is

- **Spotlight popup**: press `Alt+;` (default) anywhere on Windows 11 to summon a small floating panel.
- **Browse + search**: 3 tabs (Emoji / Symbols / Kaomoji), each with curated sub-category chips, plus a unified synonym-aware search across all 14,870 items.
- **Local-first**: catalog is bundled in the app. No network, no account, no telemetry.
- **Copy only**: clicking a glyph writes it to the clipboard as plain Unicode text. GlyphJet never auto-pastes into other apps.

## Why it exists

Microsoft's Win11 emoji panel supports emoji, kaomoji, and symbols, but its catalog is shallow, search has no synonym expansion, and the three kinds live in separate tabs. GlyphJet ships a deeper catalog (9,884 kaomoji / 3,091 symbols / 1,895 emoji) with the FlexSearch + alias ranking from `icon.quoc.app`, in a single fast launcher.

## Stack

- **Shell**: Rust + Tauri v2 (global hotkey, clipboard, tray, spotlight window).
- **Frontend**: TypeScript + Vite (vanilla, no React), reuses `search.ts` from the web project verbatim.
- **Data**: `data.json` (14,870 items) + `taxonomy.json` (35 groups covering 128 categories), both bundled into the frontend.

## Project layout

```
glyphjet/
├── .build/         design artifacts (PRODUCT / ARCHITECTURE / STRUCTURE / ROADMAP)
├── src/            TypeScript frontend (popup UI, search, taxonomy, state)
├── src-tauri/      Rust shell (hotkey, window, clipboard, tray, settings, commands)
├── scripts/        build_taxonomy.py, sync_data.py, bench-search.mjs
└── tests/          search + taxonomy regression (Vitest)
```

## Develop

Requirements: Node 20+, pnpm, Rust 1.77+ (Tauri CLI 2.x), WebView2 runtime (bundled on Win11).

```bash
pnpm install
pnpm tauri dev
```

## Build installer

```bash
pnpm tauri build
```

Outputs `src-tauri/target/release/bundle/{msi,nsis}/`.

## Hotkey

- Default: `Alt+;` (registers reliably via Win32 `RegisterHotKey`).
- `Win+;` is available as an experimental option in Settings; it cannot reliably override the Microsoft emoji panel because Windows reserves Win+; and Win+. at a low level.

## Refresh data

After the web project updates `data.json`:

```bash
pnpm sync:data
pnpm build:taxonomy
```

The taxonomy builder validates that every category in the data has a group (catch-all policy) and fails loudly if anything is unmapped.

## License

Private project.
