import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { getAllPlayerLayouts, getPlayerLayout, replacePlayerLayout, setAllPlayerLayouts } from "./camera-style-service.js";
import { applyCameraLayoutsNow } from "./live-camera-renderer.js";
import { applySceneProfile, getSceneProfile, getSceneProfileLayout, resetSceneProfile, sceneProfileEnabled } from "./scene-camera.js";
import { clearLoadedSceneProfileDraft, getLoadedSceneProfileDraft } from "./state.js";

export const LEGACY_LAYOUT_KEYS = ["preset", "snap", "resize", "position", "top", "left", "width", "height"];
export const CONFIG_EXPORT_VERSION = 1;

export function localize(key) {
  return game.i18n.localize(`${MODULE_ID}.${key}`);
}

export function usersForConfig() {
  return game.users.filter((user) => user.active);
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

function cloneValue(value) {
  return foundry.utils.deepClone(value ?? {});
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

export function sanitizeLayouts(layouts) {
  const next = {};
  Object.entries(layouts ?? {}).forEach(([playerId, layout]) => {
    next[playerId] = sanitizeLayout(layout);
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
    const layouts = sanitizeLayouts(draftLayouts);
    const current = layouts[selectedUserId] ?? {};
    layouts[selectedUserId] = foundry.utils.mergeObject(current, patch, { inplace: false });
    await setAllPlayerLayouts(layouts);
    await applySceneProfile(sceneId, layouts);
    clearLoadedSceneProfileDraft(sceneId);
  } else {
    const currentGlobalLayout = sanitizeLayout(getPlayerLayout(selectedUserId));
    const nextGlobalLayout = foundry.utils.mergeObject(currentGlobalLayout, patch, { inplace: false });
    await replacePlayerLayout(selectedUserId, nextGlobalLayout);
    if (sceneId) {
      const sceneLayouts = sanitizeLayouts(getSceneProfile()?.layouts ?? getAllPlayerLayouts());
      const currentSceneLayout = sceneLayouts[selectedUserId] ?? nextGlobalLayout;
      sceneLayouts[selectedUserId] = foundry.utils.mergeObject(currentSceneLayout, patch, { inplace: false });
      await applySceneProfile(sceneId, sceneLayouts);
    }
  }
  applyCameraLayoutsNow();
}

export function normalizeImportPayload(json) {
  if (!json || typeof json !== "object") return null;
  const settings = json.settings ?? json;
  const playerLayouts = sanitizeLayouts(settings.playerLayouts ?? {});
  const sceneProfiles = settings.sceneProfiles && typeof settings.sceneProfiles === "object" ? settings.sceneProfiles : {};
  const sceneCamera = settings.sceneCamera && typeof settings.sceneCamera === "object" ? settings.sceneCamera : {};
  return {
    playerLayouts,
    sceneProfiles,
    sceneCamera
  };
}

export function configExportPayload() {
  return {
    moduleId: MODULE_ID,
    version: CONFIG_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      playerLayouts: sanitizeLayouts(getAllPlayerLayouts()),
      sceneProfiles: foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS_KEYS.SCENE_PROFILES) ?? {}),
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

export async function resetCurrentSceneProfileConfig() {
  const sceneId = currentSceneId();
  if (!sceneId) return false;
  await resetSceneProfile(sceneId);
  clearLoadedSceneProfileDraft(sceneId);
  applyCameraLayoutsNow();
  return true;
}
