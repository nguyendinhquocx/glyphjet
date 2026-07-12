<div align="center">

# GlyphJet

A fast Windows spotlight launcher for emoji, Unicode symbols, and kaomoji.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Windows 11](https://img.shields.io/badge/Platform-Windows%2011-0078D4.svg)](https://github.com/nguyendinhquocx/glyphjet/releases)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri%20v2-FFC131.svg)](https://v2.tauri.app)
[![Rust](https://img.shields.io/badge/Rust-1.77%2B-CE422B.svg)](https://www.rust-lang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6.svg)](https://www.typescriptlang.org)

</div>

Press a global hotkey, browse categories or search, copy a glyph, paste it anywhere. **14,870 items** in one fast, local-first launcher — no network, no account, no telemetry.

<!-- Replace this block with a real screenshot of the popup once available -->
> 📸 **Screenshot placeholder** — see [Adding screenshots](#adding-screenshots) below.

---

## Highlights

- **Spotlight popup** — press `Alt+;` (default) anywhere on Windows 11 to summon a small floating panel.
- **Browse + search** — three tabs (Emoji / Symbols / Kaomoji), each with curated sub-category chips, plus a unified synonym-aware search across all items.
- **Deep catalog** — 9,884 kaomoji, 3,091 Unicode symbols, 1,895 emoji.
- **Smart ranking** — synonym expansion (`kitty` → cat, `hearts` → love), exact-glyph paste (`→` resolves instantly), and typo-tolerant fallback.
- **Local-first** — the catalog is bundled in the app. Nothing leaves your machine.
- **Copy only** — clicking a glyph writes plain Unicode text to the clipboard. GlyphJet never auto-pastes into other apps.
- **System tray** — quick access to open the popup, settings, and exit.

## Why GlyphJet

Windows 11 ships an emoji panel, but its catalog is shallow, search has no synonym expansion, and emoji, kaomoji, and symbols live behind separate tabs. GlyphJet bundles a deeper catalog with the FlexSearch + alias ranking from [icon.quoc.app](https://icon.quoc.app), behind a single fast launcher surface.

## Download

Prebuilt installers (MSI / NSIS) are published on the **[Releases](https://github.com/nguyendinhquocx/glyphjet/releases)** page.

If no release is available yet, build from source below.

## Build from source

### Requirements

- **Node.js** 20+
- **pnpm** (`npm i -g pnpm`)
- **Rust** 1.77+ (with **MSVC Build Tools** for Windows)
- **WebView2 Runtime** (bundled on Windows 11)

### Steps

```bash
git clone https://github.com/nguyendinhquocx/glyphjet.git
cd glyphjet
pnpm install
pnpm tauri dev
```

To produce an installer:

```bash
pnpm tauri build
```

Outputs land in `src-tauri/target/release/bundle/{msi,nsis}/`.

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Toggle popup | `Alt+;` (default, configurable) |
| Close popup | `Esc` |
| Search | Start typing |
| Copy glyph | Click a cell |

## How it works

GlyphJet is a Tauri v2 app: a small Rust shell handles the global hotkey, spotlight window, clipboard, tray, and settings persistence, while a vanilla TypeScript frontend (no framework) renders the browse and search UI in WebView2.

```
glyphjet/
├── src/            TypeScript frontend — popup UI, search, taxonomy, state
├── src-tauri/      Rust shell — hotkey, window, clipboard, tray, settings
├── scripts/        build_taxonomy.py, sync_data.py, bench-search.mjs
└── tests/          search + taxonomy regression (Vitest)
```

The search engine is a FlexSearch wrapper with a bounded English synonym map. It runs at most three lookups per query per type, with an O(1) exact-glyph fast path for pasted symbols. The index builds in ~130 ms for the full 14,870-item catalog; queries average **0.04 ms**.

### Hotkey notes

- `Alt+;` registers reliably via the Win32 `RegisterHotKey` API.
- `Win+;` is available as an experimental option in Settings, but it cannot reliably override the Microsoft emoji panel because Windows reserves `Win+;` and `Win+.` at a low level.

## Data sources

- **Emoji** — Unicode CLDR short names and categories.
- **Symbols** — Unicode blocks (arrows, math, currency, geometric, dingbats, box-drawing, etc.).
- **Kaomoji** — curated from community kaomoji collections, grouped into 15 thematic clusters.
- **Search taxonomy** — ported from the [icon.quoc.app](https://icon.quoc.app) web project.

The taxonomy builder validates that every category in `data.json` has a group (catch-all policy) and fails loudly if anything is unmapped.

## Adding screenshots

Screenshots are not bundled yet. To add them:

1. Run `pnpm tauri dev` and capture the popup in browse mode, search mode, and the kaomoji view.
2. Save them under `docs/screenshots/` (for example `browse.png`, `search.png`, `kaomoji.png`).
3. Replace the placeholder block at the top of this README with:

```markdown
<p align="center">
  <img src="docs/screenshots/browse.png" width="560" alt="GlyphJet browse view" />
</p>
```

## Development

```bash
pnpm test          # run Vitest regression suite
pnpm bench         # benchmark FlexSearch index build + queries
pnpm build:taxonomy   # rebuild taxonomy.json from data.json (maintainer)
```

`scripts/sync_data.py` is a maintainer script that copies `data.json` from a local checkout of the upstream web project. Point `GLYPHJET_WEB_DATA` at your copy:

```bash
GLYPHJET_WEB_DATA=/path/to/icon/public/data.json py -3.13 scripts/sync_data.py
```

## Contributing

Issues and pull requests are welcome. For non-trivial changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE) © Quoc Nguyen
