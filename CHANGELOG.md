# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-03-26

### Added
- Dedicated configuration hub with separate windows for Layout, Effects, Overlay, and Name Style.
- Shared config helpers to keep per-player editing consistent across all dedicated windows.
- Player-reset action with confirmation to clear both global and current-scene camera overrides for the selected user.

### Changed
- Main camera config window now focuses on player selection, section summaries, and entry points to dedicated editors.
- Name Style configuration now follows the same selected-player workflow as the other dedicated windows.
- Scene macro export is labeled explicitly as a scene-level action.
- Release metadata restored to stable production identity in manifest:
  - module id: `charlemos-camera-layout`
  - manifest URL on `main`
  - download URL on tag archive `v1.3.0`

### Fixed
- Removed misleading scene-wide reset action from the player-focused config hub.
- Prevented branch-testing module identifiers from leaking into the stable release build.

### Quality
- Updated localization strings (`en`, `es`, `gl`) for the new config hub workflow.
- Added unit coverage for removing a single player layout without affecting other players.

## [1.2.0] - 2026-03-26

### Added
- New overlay frame fitting controls in camera config:
  - **Overlay Fit Mode**: `auto`, `cover`, `contain`, `fill`
  - **Overlay Anchor**: center, edges and corners
- Updated localization strings (`en`, `es`, `gl`) for the new overlay controls.
- New and expanded unit tests for overlay fit/anchor normalization and renderer behavior.

### Changed
- Overlay rendering now applies explicit `background-size` and `background-position` from configuration.
- Legacy frame fallback behavior is preserved in `auto` mode for backward compatibility.
- Release metadata restored to stable production identity in manifest:
  - module `id`: `charlemos-camera-layout`
  - manifest URL on `main`
  - download URL on tag archive `v1.2.0`

### Fixed
- Avoided unexpected cropping with non-4:3 frame overlays by allowing `contain` fit mode.
- Prevented frame fallback logic from overriding explicit fit/anchor choices.

### Quality
- `npm test` passing with updated coverage for:
  - `tests/unit/camera-config-model.test.js`
  - `tests/unit/camera-layout-style.test.js`
  - `tests/unit/live-camera-renderer.test.js`

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
