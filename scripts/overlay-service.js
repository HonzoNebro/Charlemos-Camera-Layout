import { updatePlayerLayout } from "./camera-style-service.js";

export function setPlayerOverlay(playerId, overlay) {
  return updatePlayerLayout(playerId, { overlay });
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
