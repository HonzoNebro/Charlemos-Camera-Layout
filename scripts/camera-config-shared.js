import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { getAllPlayerLayouts, getPlayerLayout, removePlayerLayout, replacePlayerLayout, setAllPlayerLayouts } from "./camera-style-service.js";
import { applyCameraLayoutsNow } from "./live-camera-renderer.js";
import { applySceneProfile, getSceneCameraControlMode, getSceneProfile, getSceneProfileLayout, resetSceneProfile, sceneProfileEnabled } from "./scene-camera.js";
import { clearLoadedSceneProfileDraft, getLoadedSceneProfileDraft } from "./state.js";

export const LEGACY_LAYOUT_KEYS = ["preset", "snap", "resize"];
export const CONFIG_EXPORT_VERSION = 1;

export function localize(key) {
  return game.i18n.localize(`${MODULE_ID}.${key}`);
}

export function usersForConfig(options = {}) {
  const activeOnly = Boolean(options.activeOnly);
  const users = game.users?.contents ?? Array.from(game.users ?? []);
  const filtered = activeOnly ? users.filter((user) => user.active) : users;
  return [...filtered].sort((a, b) => {
    if (Boolean(b.active) !== Boolean(a.active)) return Number(b.active) - Number(a.active);
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
}

export function selectedUser(users, selectedUserId) {
  const selected = users.find((user) => user.id === selectedUserId);
  if (selected) return selected;
  return users[0] ?? null;
}

export function currentSceneId() {
  return canvas.scene?.id ?? null;
}

export function loadedDraftLayouts(sceneId) {
  const draft = getLoadedSceneProfileDraft(sceneId);
  if (!draft) return null;
  return draft.layouts ?? null;
}

export function loadedDraftCameraControlMode(sceneId) {
  const draft = getLoadedSceneProfileDraft(sceneId);
  if (!draft) return null;
  return draft.cameraControlMode ?? "native";
}

function cloneValue(value) {
  if (typeof foundry !== "undefined" && foundry?.utils?.deepClone) return foundry.utils.deepClone(value ?? {});
  if (typeof structuredClone === "function") return structuredClone(value ?? {});
  return JSON.parse(JSON.stringify(value ?? {}));
}

export function sanitizeLayout(layout) {
  const next = cloneValue(layout);
  LEGACY_LAYOUT_KEYS.forEach((key) => {
    delete next[key];
  });
  if (next.geometry) {
    next.geometry = {
      borderRadius: next.geometry.borderRadius ?? null
    };
  }
  return next;
}

export function sanitizeLayoutForCameraControlMode(layout, cameraControlMode) {
  const next = sanitizeLayout(layout);
  if (cameraControlMode === "module") return next;
  delete next.position;
  delete next.top;
  delete next.left;
  delete next.width;
  delete next.height;
  delete next.relative;
  return next;
}

export function sanitizeLayouts(layouts, cameraControlMode = "module") {
  const next = {};
  Object.entries(layouts ?? {}).forEach(([playerId, layout]) => {
    next[playerId] = sanitizeLayoutForCameraControlMode(layout, cameraControlMode);
  });
  return next;
}

export function readText(form, name) {
  return form.elements.namedItem(name)?.value ?? "";
}

export function readChecked(form, name) {
  return Boolean(form.elements.namedItem(name)?.checked);
}

export function setFieldValue(form, name, value) {
  const field = form.elements.namedItem(name);
  if (!field) return;
  field.value = String(value ?? "");
}

export function loadLayoutForUser(selectedUserId) {
  const sceneId = currentSceneId();
  const draftLayouts = loadedDraftLayouts(sceneId);
  if (!selectedUserId) return null;
  if (draftLayouts?.[selectedUserId]) return draftLayouts[selectedUserId];
  if (sceneProfileEnabled()) return getSceneProfileLayout(selectedUserId) ?? getPlayerLayout(selectedUserId);
  return getPlayerLayout(selectedUserId);
}

export async function saveLayoutPatchForUser(selectedUserId, patch) {
  if (!selectedUserId) return;
  const sceneId = currentSceneId();
  const draftLayouts = loadedDraftLayouts(sceneId);
  if (sceneId && draftLayouts) {
    const layouts = sanitizeLayouts(draftLayouts, loadedDraftCameraControlMode(sceneId) ?? getSceneCameraControlMode());
    const current = layouts[selectedUserId] ?? {};
    layouts[selectedUserId] = foundry.utils.mergeObject(current, patch, { inplace: false });
    await setAllPlayerLayouts(layouts);
    await applySceneProfile(sceneId, layouts, { cameraControlMode: loadedDraftCameraControlMode(sceneId) ?? getSceneCameraControlMode() });
    clearLoadedSceneProfileDraft(sceneId);
  } else {
    const currentGlobalLayout = sanitizeLayout(getPlayerLayout(selectedUserId));
    const nextGlobalLayout = foundry.utils.mergeObject(currentGlobalLayout, patch, { inplace: false });
    await replacePlayerLayout(selectedUserId, nextGlobalLayout);
    if (sceneId) {
      const sceneControlMode = getSceneCameraControlMode();
      const sceneLayouts = sanitizeLayouts(getSceneProfile()?.layouts ?? getAllPlayerLayouts(), sceneControlMode);
      const currentSceneLayout = sceneLayouts[selectedUserId] ?? nextGlobalLayout;
      sceneLayouts[selectedUserId] = foundry.utils.mergeObject(currentSceneLayout, patch, { inplace: false });
      await applySceneProfile(sceneId, sceneLayouts, { cameraControlMode: sceneControlMode });
    }
  }
  applyCameraLayoutsNow();
}

export function normalizeImportPayload(json) {
  if (!json || typeof json !== "object") return null;
  const settings = json.settings ?? json;
  const playerLayouts = sanitizeLayouts(settings.playerLayouts ?? {}, "module");
  const sceneProfiles =
    settings.sceneProfiles && typeof settings.sceneProfiles === "object"
      ? Object.fromEntries(
          Object.entries(settings.sceneProfiles).map(([sceneId, profile]) => {
            const cameraControlMode = profile?.cameraControlMode ?? "native";
            return [
              sceneId,
              {
                enabled: profile?.enabled !== false,
                cameraControlMode,
                layouts: sanitizeLayouts(profile?.layouts ?? {}, cameraControlMode)
              }
            ];
          })
        )
      : {};
  const sceneCamera = settings.sceneCamera && typeof settings.sceneCamera === "object" ? settings.sceneCamera : {};
  return {
    playerLayouts,
    sceneProfiles,
    sceneCamera
  };
}

export function configExportPayload() {
  const rawSceneProfiles = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS_KEYS.SCENE_PROFILES) ?? {});
  const sceneProfiles = Object.fromEntries(
    Object.entries(rawSceneProfiles).map(([sceneId, profile]) => {
      const cameraControlMode = profile?.cameraControlMode ?? "native";
      return [
        sceneId,
        {
          enabled: profile?.enabled !== false,
          cameraControlMode,
          layouts: sanitizeLayouts(profile?.layouts ?? {}, cameraControlMode)
        }
      ];
    })
  );
  return {
    moduleId: MODULE_ID,
    version: CONFIG_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      playerLayouts: sanitizeLayouts(getAllPlayerLayouts(), "module"),
      sceneProfiles,
      sceneCamera: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS_KEYS.SCENE_CAMERA) ?? {})
    }
  };
}

export async function importJsonConfigFile(file) {
  const text = await file.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    return false;
  }
  const payload = normalizeImportPayload(parsed);
  if (!payload) return false;
  await game.settings.set(MODULE_ID, SETTINGS_KEYS.PLAYER_LAYOUTS, payload.playerLayouts);
  await game.settings.set(MODULE_ID, SETTINGS_KEYS.SCENE_PROFILES, payload.sceneProfiles);
  await game.settings.set(MODULE_ID, SETTINGS_KEYS.SCENE_CAMERA, payload.sceneCamera);
  clearLoadedSceneProfileDraft(currentSceneId());
  applyCameraLayoutsNow();
  return true;
}

export async function resetLayoutForUser(selectedUserId) {
  if (!selectedUserId) return false;
  const sceneId = currentSceneId();
  let changed = await removePlayerLayout(selectedUserId);
  if (sceneId) {
    const draftLayouts = loadedDraftLayouts(sceneId);
    const sceneControlMode = loadedDraftCameraControlMode(sceneId) ?? getSceneCameraControlMode();
    const sceneLayouts = sanitizeLayouts(draftLayouts ?? getSceneProfile()?.layouts ?? {}, sceneControlMode);
    if (selectedUserId in sceneLayouts) {
      delete sceneLayouts[selectedUserId];
      changed = true;
      if (Object.keys(sceneLayouts).length === 0) await resetSceneProfile(sceneId);
      else await applySceneProfile(sceneId, sceneLayouts, { cameraControlMode: sceneControlMode });
    }
    clearLoadedSceneProfileDraft(sceneId);
  }
  applyCameraLayoutsNow();
  return changed;
}
