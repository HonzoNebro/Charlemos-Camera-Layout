import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";

function getSceneId(scene) {
  return scene?.id ?? canvas.scene?.id;
}

function readSceneCameraSetting() {
  return game.settings.get(MODULE_ID, SETTINGS_KEYS.SCENE_CAMERA) ?? {};
}

function writeSceneCameraSetting(value) {
  return game.settings.set(MODULE_ID, SETTINGS_KEYS.SCENE_CAMERA, value);
}

function readSceneProfilesSetting() {
  return game.settings.get(MODULE_ID, SETTINGS_KEYS.SCENE_PROFILES) ?? {};
}

function writeSceneProfilesSetting(value) {
  return game.settings.set(MODULE_ID, SETTINGS_KEYS.SCENE_PROFILES, value);
}

export function getSceneCamera(scene) {
  const sceneId = getSceneId(scene);
  const sceneCameras = readSceneCameraSetting();
  return sceneCameras[sceneId] ?? null;
}

export async function setSceneCamera(sceneId, playerId) {
  const sceneCameras = readSceneCameraSetting();
  sceneCameras[sceneId] = { playerId };
  await writeSceneCameraSetting(sceneCameras);
  console.debug(`${MODULE_ID} | scene camera updated`, { sceneId, playerId });
  return sceneCameras[sceneId];
}

export function getSceneProfile(scene) {
  const sceneId = getSceneId(scene);
  const sceneData = readSceneProfilesSetting();
  return sceneData[sceneId] ?? null;
}

export function sceneProfileEnabled(scene) {
  const profile = getSceneProfile(scene);
  return Boolean(profile?.enabled);
}

export function getSceneProfileLayout(playerId, scene) {
  const profile = getSceneProfile(scene);
  if (!profile?.enabled) return null;
  return profile?.layouts?.[playerId] ?? null;
}

export async function applySceneProfile(sceneId, layouts) {
  const sceneData = readSceneProfilesSetting();
  sceneData[sceneId] = {
    enabled: true,
    layouts
  };
  await writeSceneProfilesSetting(sceneData);
  console.debug(`${MODULE_ID} | scene profile applied`, { sceneId });
  return sceneData[sceneId];
}

export async function resetSceneProfile(sceneId) {
  const sceneData = readSceneProfilesSetting();
  if (!(sceneId in sceneData)) return false;
  delete sceneData[sceneId];
  await writeSceneProfilesSetting(sceneData);
  console.debug(`${MODULE_ID} | scene profile reset`, { sceneId });
  return true;
}

export async function updateSceneProfileLayout(sceneId, playerId, patch) {
  const sceneData = readSceneProfilesSetting();
  const current = sceneData[sceneId] ?? { enabled: false, layouts: {} };
  const layouts = foundry.utils.deepClone(current.layouts ?? {});
  const playerLayout = layouts[playerId] ?? {};
  layouts[playerId] = foundry.utils.mergeObject(playerLayout, patch, { inplace: false });
  sceneData[sceneId] = {
    ...current,
    layouts
  };
  await writeSceneProfilesSetting(sceneData);
  console.debug(`${MODULE_ID} | scene profile layout updated`, { sceneId, playerId, patch });
  return layouts[playerId];
}

export async function migrateLegacySceneProfiles() {
  const sceneCameras = readSceneCameraSetting();
  const sceneProfiles = readSceneProfilesSetting();
  let changed = false;
  for (const [sceneId, value] of Object.entries(sceneCameras)) {
    const isLegacyProfile = Boolean(value && typeof value === "object" && value.layouts && value.enabled !== undefined);
    if (!isLegacyProfile) continue;
    if (!sceneProfiles[sceneId]) {
      sceneProfiles[sceneId] = value;
      changed = true;
    }
    delete sceneCameras[sceneId];
    changed = true;
  }
  if (!changed) return false;
  await writeSceneProfilesSetting(sceneProfiles);
  await writeSceneCameraSetting(sceneCameras);
  console.debug(`${MODULE_ID} | legacy scene profiles migrated`);
  return true;
}
