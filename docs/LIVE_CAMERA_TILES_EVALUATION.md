# Positioned live-camera pseudo-tiles: evaluation

Status: evaluation complete; not an implemented feature or a promise of native Tile compatibility. Reviewed on 2026-09-19 for the preview roadmap.

## Conclusion

A positioned runtime camera mesh is feasible in principle. It should be a separate opt-in feature with its own persisted placement records, not a live stream stored in a Tile document or a modification of the current background configuration. No pseudo-tile setting, document or runtime node is introduced by this beta.

Foundry exposes a texture-backed PrimarySpriteMesh with sizing, anchor and rendering behavior in both [V13](https://foundryvtt.com/api/v13/classes/foundry.canvas.primary.PrimarySpriteMesh.html) and [V14](https://foundryvtt.com/api/v14/classes/foundry.canvas.primary.PrimarySpriteMesh.html). [TileData](https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.TileData.html) supplies persistent placement and texture fields, while [TextureData](https://foundryvtt.com/api/v14/classes/foundry.data.TextureData.html) describes a file-path source. These contracts do not expose persistent MediaStream storage. Inferring feasibility from these APIs does not establish compatibility with every Foundry build or module.

## Evidence in Charlemos

The current `scene-background-renderer.js` already owns an ephemeral PrimarySpriteMesh, BaseImageResource, texture and throttled update callback. It resolves the existing A/V video via `camera-video-source.js`, retains no new audio player, and releases its resources without pausing, loading or stopping the camera source. The automated lifecycle suite covers replacement, unavailable feeds, masks, fitting, teardown and repeated 720p/1080p mock sources.

The renderer is currently a singleton. Its configuration, mask, scene rectangle, background sorting and status are deliberately specific to a full-scene background. Reusing it unchanged for multiple positioned objects would make their lifetime and sorting collide. A future implementation must first extract a reusable owned-video-texture lifetime, with reference counting if several meshes share one video. The present beta does not perform that refactor.

## Proposed boundaries for a separately approved implementation

- Persist only stable IDs and geometry: object ID, scene ID, camera user ID, x/y/width/height in scene coordinates, rotation, fit, opacity and explicit layer/Level association. Never persist streams, HTML video elements or session URLs.
- Keep the scene background and pseudo-tile collections separate. Existing `setSceneCamera`, old macros and JSON backups must keep their meanings. Introduce optional backup fields only with validation, mapping and restoration rules.
- Render below tokens by a documented ordering policy. Test lighting, roof occlusion, scene masking and V14 Level changes in the target builds before exposing layer controls. The official versioned documentation may describe newer maintenance builds than 13.351/14.361.
- Position with scene coordinates so pan and zoom work naturally. GM handles should edit the same local draft contract, including scene binding, conflicts and undo. Do not hijack Foundry's native Tile tools or claim native Tile permissions, triggers or module integration.
- Do not reacquire camera/microphone permissions. Resolve the existing feed on each client. On loss or disconnect, remove the mesh but retain placement; recover when the same user gets a usable feed. Camera visibility is not a privacy boundary.
- Maintain a registry keyed by scene/object ID. Reconcile source, video and Level changes; release masks, textures, tickers and listeners idempotently. Never register source-owned A/V video in Foundry's video teardown collection.
- Cap texture updates at 30 FPS per source, not per mesh. Benchmark GPU uploads, memory and context loss with multiple full-HD sources. Existing mock lifecycle tests prove cleanup contracts, not real GPU cost.

## Alternatives and decision

Native Tile documents provide familiar tools but do not themselves provide a live camera texture source and would require deeper lifecycle integration. A screen-space DOM overlay cannot meet world-coordinate pan/zoom and occlusion requirements. A module-owned canvas mesh is therefore the preferred candidate for a future prototype.

The roadmap's evaluation is closed with this recommendation. Actual implementation remains outside the agreed UX release, as specified in the original live-background plan. It needs a separate feature decision and real two-client Foundry validation; this beta neither enables nor advertises usable pseudo-tiles.
