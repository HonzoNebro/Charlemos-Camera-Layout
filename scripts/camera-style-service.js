import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { inferLayoutMode } from "./camera-config-model.js";

function readLayouts() {
  return game.settings.get(MODULE_ID, SETTINGS_KEYS.PLAYER_LAYOUTS) ?? {};
}

function writeLayouts(layouts) {
  return game.settings.set(MODULE_ID, SETTINGS_KEYS.PLAYER_LAYOUTS, layouts);
}

function ensurePlayerLayout(layouts, playerId) {
  const current = layouts[playerId] ?? {};
  layouts[playerId] = current;
  return current;
}

export function getAllPlayerLayouts() {
  return readLayouts();
}

export async function setAllPlayerLayouts(layouts) {
  const next = foundry.utils.deepClone(layouts ?? {});
  await writeLayouts(next);
  console.debug(`${MODULE_ID} | all player layouts replaced`, { count: Object.keys(next).length });
  return next;
}

export function getPlayerLayout(playerId) {
  const layouts = readLayouts();
  return layouts[playerId] ?? null;
}

export async function replacePlayerLayout(playerId, nextLayout) {
  const layouts = readLayouts();
  layouts[playerId] = foundry.utils.deepClone(nextLayout ?? {});
  await writeLayouts(layouts);
  console.debug(`${MODULE_ID} | player layout replaced`, { playerId });
  return layouts[playerId];
}

export async function removePlayerLayout(playerId) {
  const layouts = readLayouts();
  if (!(playerId in layouts)) return false;
  delete layouts[playerId];
  await writeLayouts(layouts);
  console.debug(`${MODULE_ID} | player layout removed`, { playerId });
  return true;
}

export async function updatePlayerLayout(playerId, patch) {
  const layouts = readLayouts();
  const current = ensurePlayerLayout(layouts, playerId);
  layouts[playerId] = foundry.utils.mergeObject(current, patch, { inplace: false });
  await writeLayouts(layouts);
  console.debug(`${MODULE_ID} | player layout updated`, { playerId, patch });
  return layouts[playerId];
}

export function buildCameraViewStyle(layout) {
  if (!layout) return {};
  const style = {};
  const layoutMode = inferLayoutMode(layout);
  if (layoutMode === "relative") style.position = "absolute";
  else if (layout.position) style.position = layout.position;
  if (layout.top) style.top = layout.top;
  if (layout.left) style.left = layout.left;
  if (layout.width) style.width = layout.width;
  if (layout.height) style.height = layout.height;
  return style;
}

export function buildVideoStyle(layout) {
  if (!layout) return {};
  const style = {};
  if (layout.transform) style.transform = layout.transform;
  if (layout.filter) style.filter = layout.filter;
  if (layout.clipPath) style.clipPath = layout.clipPath;
  return style;
}
