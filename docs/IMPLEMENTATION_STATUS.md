# Preview implementation status

Scope: the six UX phases, short-term roadmap, composition library, viewer-role variants, guided editing, the pseudo-tile evaluation and automated quality gates. This is a development handoff for beta testing, not a stable-release acceptance certificate.

| Block | Implementation evidence | Automated verification |
| --- | --- | --- |
| 1. Scene/user binding, partial edits and native geometry retention | `edit-runtime.js`, `edit-session.js`, `editor-fields.js` | `edit-runtime`, `edit-session`, `camera-editor-app`, `api` |
| 1. External changes, conflicts and write recovery | `EditSession.reconcile`, `writeConfigurationBlocks`, editor conflict actions | Same-field/different-field conflicts, rollback and external-write protection in `edit-session` and `edit-runtime` |
| 1. Reviewed JSON import | `config-import.js`, editor import review/confirmation | `config-import`: legacy/v1/v2 validation, explicit mappings, merge/replace/restore, empty backups, role selection |
| 2. Shared drafts, history and local preview | `edit-runtime.js`, `effective-camera-state.js`, existing renderer integration | `edit-session`, `edit-runtime`, `camera-editor-app`, `scene-background-renderer` |
| 3. Unified panel, opening compatibility and translations | `camera-editor-app.js`, `hooks.js`, `lang/*.json` | `camera-editor-app`, `hooks`, configuration-window scope and i18n tests |
| 4. Basic effects, custom CSS, units, frames/names and resource state | `editor-fields.js`, `editor-effects.js`, `editor-media.js`, renderer diagnostics | `editor-effects`, `editor-media`, `camera-config-model`, `debug-report`, `camera-editor-app` |
| 5. Presets, selective copy, macros and backups | `editor-compositions.js`, `editor-profiles.js`, `macro-exporter.js`, `config-import.js` | Composition, profile, macro and import suites |
| 6. Visual gestures, units, role-aware inspector and cleanup | `visual-camera-editor.js`, scoped session adapter | `visual-camera-editor`, `camera-editor-app`, `role-variants` |
| Short term: renderer stability, blending, saved profiles and support | `camera-container-size.js`, `overlay-runtime.js`, `editor-frame-presets.js`, support reports/guides | Renderer, container, overlay, profile and support suites |
| Composition library | `profile-library.js`, `profile-library-panel.js` | Library/editor/import tests for explicit writes, mapping, stale data and undoable load |
| Viewer-role variants | `role-variants.js`, effective-state/API/import/template integration | Role, editor, API, import, runtime and library suites; legacy macro behavior retained |
| Guided crop and advanced frame alignment | `editor-shapes.js`, `editor-frame-alignment.js`, panel controls | Shape/alignment model and panel tests, including custom CSS, percentages, rotation, inheritance and undo |
| Positioned pseudo-tiles | `LIVE_CAMERA_TILES_EVALUATION.md` | Evaluation only, as specified by the roadmap; no claim of a working Tile feature |
| Automated quality gates | `tools/check-quality.mjs`, `.github/workflows/quality.yml`, layout fixture | Metadata/assets/languages/syntax, deterministic style snapshots and repeated renderer lifecycle tests |

Local verification for beta.5: all 44 test files pass. The quality command and whitespace checks pass. The CI workflow also runs on Node 20 and 22; its remote result must be checked after pushing.

## What remains to validate in Foundry

The Foundry 14.362 smoke validation confirmed the unified editor opens and that a player-view circular crop remains local until Apply. It had one GM/user and no live video feed. Real 13.351/14.361 rendering, V14 detached windows/Levels, two-client/two-GM operation, native A/V controls, keyboard focus, screen-reader behavior, real texture upload performance and memory/GPU trends are **not verified here**. Synthetic style snapshots are not pixel screenshots, and mock 720p/1080p dimensions are not camera hardware benchmarks.

Use `UX_ACCEPTANCE.md` in a backed-up test installation before approving stable promotion. A prerelease may be used to carry out these checks; it must not be described as having passed them. No stable manifest, stable tag or Foundry listing is updated by the beta workflow.
