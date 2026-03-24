# Charlemos Camera Layout

FoundryVTT module for advanced A/V camera styling and per-scene camera profiles.

## Current capabilities

- Per-player camera overlay with URL/path + file picker
- Overlay controls: opacity, move, scale, rotate, tint, blend mode
- Video effects: transform, filter, clip-path, border radius
- Camera crop masks (top/right/bottom/left)
- Name styles: source, color, font family, position
- Scene profile save/load via macros
- JSON config export/import
- Runtime renderer diagnostics mode

## Structure

- `module.json`: Foundry module manifest
- `scripts/`: module runtime code
- `styles/`: module styles
- `lang/`: i18n dictionaries
- `tests/unit/`: unit tests only
- `docs/ROADMAP.md`: short and long term roadmap
- `docs/DEVELOPMENT_RULES.md`: mandatory coding rules

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
