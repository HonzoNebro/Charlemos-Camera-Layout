# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-26

### Added
- Dedicated **Name Style Configuration** window, accessible from the camera layout config, to reduce form overload.
- Nameplate style controls for:
  - text alignment (`left`, `center`, `right`, `justify`)
  - constrained font weight presets (`400`, `500`, `600`, `700`)
  - font style (`normal`, `italic`)
- Dynamic font-family options sourced from Foundry server-available fonts, with fallback behavior.
- New rendering logic for nameplate placement and style normalization in the live camera renderer.
- Unit tests covering new name style normalization and config model behavior.

### Changed
- Nameplate visual style updated to better match native Foundry framing (blur/plate feel and camera-edge fit for top/bottom placement).
- Camera config model and app were refactored to support dedicated name config flow and stricter value normalization.
- Runtime metadata restored from branch-testing identity to stable production identity (`charlemos-camera-layout`).
- Release metadata updated for stable distribution:
  - module version: `1.1.0`
  - download URL points to tag archive `v1.1.0`

### Fixed
- Reduced overlap issues between custom nameplate rendering and native camera controls.
- Improved behavior when native and custom naming modes coexist, including native-name fallback support.

### Quality
- Updated translations (`en`, `es`, `gl`) for new name configuration capabilities.
- Added/updated tests in:
  - `tests/unit/camera-config-model.test.js`
  - `tests/unit/camera-layout-style.test.js`

## [1.0.0] - 2026-03-20

### Added
- Initial stable release of Charlemos Camera Layout.
- Per-player camera styling, scene profile support, overlay controls, and export/import tooling.
