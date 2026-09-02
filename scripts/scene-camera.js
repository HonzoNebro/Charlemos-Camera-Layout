import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { normalizeOverlayConfiguration } from "./overlay-bounds.js";

const CAMERA_CONTROL_MODE_VALUES = new Set(["native", "module"]);
const SCENE_CAMERA_FIT_VALUES = new Set(["cover", "contain", "fill"]);

function normalizeCameraControlMode(value) {
  const text = String(value ?? "").trim();
  if (CAMERA_CONTROL_MODE_VALUES.has(text)) return text;
  return "native";
}

export function normalizeSceneCameraFit(value) {
  const text = String(value ?? "").trim();
  if (SCENE_CAMERA_FIT_VALUES.has(text)) return text;
  return "cover";
}

export function normalizeSceneCamera(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const playerId = String(value.playerId ?? "").trim();
  if (!playerId) return null;
  return {
    playerId,
    fit: normalizeSceneCameraFit(value.fit)
  };
}

export function sanitizeSceneCameras(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([sceneId, sceneCamera]) => {
      const normalizedSceneId = String(sceneId ?? "").trim();
      const normalizedSceneCamera = normalizeSceneCamera(sceneCamera);
      if (!normalizedSceneId || !normalizedSceneCamera) return [];
      return [[normalizedSceneId, normalizedSceneCamera]];
    })
  );
}

function getSceneId(scene) {
  return scene?.id ?? globalThis.canvas?.scene?.id;
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

function cloneValue(value) {
  if (typeof foundry !== "undefined" && foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value ?? {}));
}

function normalizeProfileLayouts(layouts) {
  return Object.fromEntries(
    Object.entries(cloneValue(layouts ?? {})).map(([playerId, layout]) => {
      if (!layout?.overlay) return [playerId, layout];
      return [
        playerId,
        {
          ...layout,
          overlay: normalizeOverlayConfiguration(layout.overlay)
        }
      ];
    })
  );
}

export function getSceneCamera(scene) {
  const sceneId = getSceneId(scene);
  const sceneCameras = readSceneCameraSetting();
  return normalizeSceneCamera(sceneCameras[sceneId]);
}

export async function setSceneCamera(sceneId, playerId, options = {}) {
  const normalizedSceneId = String(sceneId ?? "").trim();
  const sceneCamera = normalizeSceneCamera({
    playerId,
    fit: options?.fit
  });
  if (!normalizedSceneId || !sceneCamera) return null;
  const sceneCameras = sanitizeSceneCameras(readSceneCameraSetting());
  sceneCameras[normalizedSceneId] = sceneCamera;
  await writeSceneCameraSetting(sceneCameras);
  console.debug(`${MODULE_ID} | scene camera updated`, { sceneId: normalizedSceneId, ...sceneCamera });
  return sceneCamera;
}

export function getSceneProfile(scene) {
  const sceneId = getSceneId(scene);
  const sceneData = readSceneProfilesSetting();
  const profile = sceneData[sceneId];
  if (!profile) return null;
  return {
    ...profile,
    layouts: normalizeProfileLayouts(profile.layouts)
  };
}

export function getSceneCameraControlMode(scene) {
  const profile = getSceneProfile(scene);
  return normalizeCameraControlMode(profile?.cameraControlMode);
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

export async function applySceneProfile(sceneId, layouts, options = {}) {
  const sceneData = readSceneProfilesSetting();
  const current = sceneData[sceneId] ?? {};
  sceneData[sceneId] = {
    enabled: true,
    cameraControlMode: normalizeCameraControlMode(options.cameraControlMode ?? current.cameraControlMode),
    layouts: normalizeProfileLayouts(layouts)
  };
  await writeSceneProfilesSetting(sceneData);
  console.debug(`${MODULE_ID} | scene profile applied`, { sceneId });
  return sceneData[sceneId];
}

export async function setSceneCameraControlMode(sceneId, cameraControlMode) {
  const sceneData = readSceneProfilesSetting();
  const current = sceneData[sceneId] ?? { enabled: true, layouts: {} };
  sceneData[sceneId] = {
    ...current,
    enabled: true,
    cameraControlMode: normalizeCameraControlMode(cameraControlMode),
    layouts: normalizeProfileLayouts(current.layouts)
  };
  await writeSceneProfilesSetting(sceneData);
  console.debug(`${MODULE_ID} | scene camera control mode updated`, { sceneId, cameraControlMode: sceneData[sceneId].cameraControlMode });
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

export async function resetSceneCamera(sceneId) {
  const sceneCameras = readSceneCameraSetting();
  if (!(sceneId in sceneCameras)) return false;
  delete sceneCameras[sceneId];
  await writeSceneCameraSetting(sceneCameras);
  console.debug(`${MODULE_ID} | scene camera reset`, { sceneId });
  return true;
}

export async function updateSceneProfileLayout(sceneId, playerId, patch) {
  const sceneData = readSceneProfilesSetting();
  const current = sceneData[sceneId] ?? { enabled: false, layouts: {} };
  const layouts = foundry.utils.deepClone(current.layouts ?? {});
  const playerLayout = layouts[playerId] ?? {};
  layouts[playerId] = normalizeProfileLayouts({
    [playerId]: foundry.utils.mergeObject(playerLayout, patch, { inplace: false })
  })[playerId];
  sceneData[sceneId] = {
    ...current,
    cameraControlMode: normalizeCameraControlMode(current.cameraControlMode),
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
  const normalizedSceneCameras = sanitizeSceneCameras(sceneCameras);
  if (JSON.stringify(normalizedSceneCameras) !== JSON.stringify(sceneCameras)) changed = true;
  if (!changed) return false;
  await writeSceneProfilesSetting(sceneProfiles);
  await writeSceneCameraSetting(normalizedSceneCameras);
  console.debug(`${MODULE_ID} | legacy scene profiles migrated`);
  return true;
}

export async function pruneMissingSceneState(validSceneIds = []) {
  const validIds = new Set((validSceneIds ?? []).filter(Boolean));
  const sceneProfiles = readSceneProfilesSetting();
  const sceneCameras = readSceneCameraSetting();
  const removedSceneProfiles = [];
  const removedSceneCameras = [];

  Object.keys(sceneProfiles).forEach((sceneId) => {
    if (validIds.has(sceneId)) return;
    delete sceneProfiles[sceneId];
    removedSceneProfiles.push(sceneId);
  });

  Object.keys(sceneCameras).forEach((sceneId) => {
    if (validIds.has(sceneId)) return;
    delete sceneCameras[sceneId];
    removedSceneCameras.push(sceneId);
  });

  if (removedSceneProfiles.length === 0 && removedSceneCameras.length === 0) {
    return {
      removedSceneProfiles,
      removedSceneCameras
    };
  }

  await writeSceneProfilesSetting(sceneProfiles);
  await writeSceneCameraSetting(sceneCameras);
  console.debug(`${MODULE_ID} | missing scene state pruned`, {
    removedSceneProfiles,
    removedSceneCameras
  });
  return {
    removedSceneProfiles,
    removedSceneCameras
  };
}
