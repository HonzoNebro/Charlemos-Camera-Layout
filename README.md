# Charlemos Camera Layout

FoundryVTT module for advanced A/V camera styling and per-scene camera profiles.

## Current capabilities

- Scene-level camera control mode: `native` or `module`
- Absolute and relative camera layouts with persisted `top`, `left`, `width`, `height`, target, placement and gap
- Scene layout presets: dynamic grid, narrative presets, responsive or fixed units
- Per-player camera overlay with URL/path + file picker
- Overlay controls: opacity, move, scale, rotate, fit mode, anchor, tint, blend mode
- Video effects: transform, filter, clip-path, border radius
- Camera crop masks (top/right/bottom/left)
- Name styles: source, color, font family (Foundry fonts), position, alignment, weight and italic
- Reusable scene profile macros that apply to the active scene
- Offline-player editing support
- JSON config export/import
- Runtime renderer diagnostics mode

## Structure

- `module.json`: Foundry module manifest
- `CHANGELOG.md`: release notes and version history
- `AGENTS.md`: permanent instructions for coding agents
- `scripts/`: module runtime code
- `styles/`: module styles
- `lang/`: i18n dictionaries
- `tests/unit/`: unit tests only
- `docs/ROADMAP.md`: short and long term roadmap
- `docs/DEVELOPMENT_RULES.md`: mandatory coding rules
- `.github/workflows/release-guard-pr.yml`: validates release metadata and tests on PRs to `main`
- `.github/workflows/release-tag-on-version-bump.yml`: auto-tags releases after version bumps reach `main`

## Run tests

```bash
npm test
```

## Foundry install

- Manifest URL: `https://raw.githubusercontent.com/HonzoNebro/Charlemos-Camera-Layout/main/module.json`

## Languages

- English (`en`)
- Español (`es`)
- Galego (`gl`)

## License and provenance

- License: MIT (`LICENSE`)
- AI usage notice: included in `LICENSE`
- Asset provenance: `docs/ASSET_PROVENANCE.md`
