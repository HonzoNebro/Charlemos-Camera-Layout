import { updatePlayerLayout } from "./camera-style-service.js";
import { normalizeOverlayConfiguration } from "./overlay-bounds.js";
import { applySceneProfile, getSceneProfile } from "./scene-camera.js";

export async function setPlayerOverlay(playerId, overlay) {
  const normalizedOverlay = normalizeOverlayConfiguration(overlay);
  const sceneId = globalThis.canvas?.scene?.id;
  if (!sceneId) return updatePlayerLayout(playerId, { overlay: normalizedOverlay });
  const profile = getSceneProfile({ id: sceneId }) ?? {};
  const layouts = foundry.utils.deepClone(profile.layouts ?? {});
  layouts[playerId] = foundry.utils.mergeObject(layouts[playerId] ?? {}, { overlay: normalizedOverlay }, { inplace: false });
  const saved = await applySceneProfile(sceneId, layouts, { cameraControlMode: profile.cameraControlMode });
  return saved.layouts[playerId];
}

export function setPlayerNameStyle(playerId, nameStyle) {
  return updatePlayerLayout(playerId, { nameStyle });
}

export function setPlayerVideoFilter(playerId, filter) {
  return updatePlayerLayout(playerId, { filter });
}

export function setPlayerGeometry(playerId, geometry) {
  return updatePlayerLayout(playerId, { geometry });
}
