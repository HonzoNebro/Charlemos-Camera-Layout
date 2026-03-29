# Charlemos Camera Layout

FoundryVTT module for advanced A/V camera styling with scene-scoped camera profiles.

## Current capabilities

- Scene-scoped camera control mode: `native` or `module`
- Absolute and relative camera layouts with persisted `top`, `left`, `width`, `height`, target, placement and gap
- Scene layout presets: dynamic grid, narrative presets, responsive or fixed units
- Per-player camera overlay with URL/path + file picker
- Overlay controls: opacity, move, scale, rotate, fit mode, anchor, tint, blend mode
- Video effects: transform, filter, clip-path, border radius
- Camera crop masks (top/right/bottom/left)
- Name styles: source, color, font family (Foundry fonts), position, alignment, weight and italic
- Reusable scene profile macros that apply to the active scene
- Offline-player editing support
- Explicit legacy import action to copy old global layouts into the current scene
- JSON config export/import
- Runtime renderer diagnostics mode

## Scene-scoped contract

- An active scene is required before editing layout, effects, overlays, name styles or scene presets.
- New scenes start empty by design.
- Camera styling is stored on the current scene profile.
- Reusing a composition across scenes is explicit: use scene macros, JSON import, or import legacy global layouts into the current scene.
- Legacy `playerLayouts` can still exist in settings, but they are no longer applied automatically at runtime.

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
- `docs/macros/dump_module_debug_report.js`: support macro for bug reports
- `.github/workflows/release-guard-pr.yml`: validates release metadata and tests on PRs to `main`
- `.github/workflows/release-tag-on-version-bump.yml`: auto-tags releases after version bumps reach `main`

## Run tests

```bash
npm test
```

## Diagnostics

- Enable `Renderer debug mode` in Foundry when investigating runtime problems.
- Open `Camera Layout Config` and use `Open Support Report` to generate a structured report for the selected player without using the browser console.
- Run the macro in `docs/macros/dump_module_debug_report.js` to dump a structured support report to the browser console.
- The module API also exposes:
  - `game.modules.get("charlemos-camera-layout")?.api?.dumpRendererDebugSnapshot(userId)`
  - `game.modules.get("charlemos-camera-layout")?.api?.dumpModuleDebugReport(userId)`

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
