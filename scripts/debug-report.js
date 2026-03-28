import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { dumpRendererDebugSnapshot, isRendererDebugEnabled } from "./live-camera-renderer.js";
import { getLoadedSceneProfileDraft } from "./state.js";

function cloneValue(value) {
  if (typeof foundry !== "undefined" && foundry?.utils?.deepClone) return foundry.utils.deepClone(value ?? {});
  if (typeof structuredClone === "function") return structuredClone(value ?? {});
  return JSON.parse(JSON.stringify(value ?? {}));
}

function safeSetting(key) {
  try {
    return cloneValue(game?.settings?.get(MODULE_ID, key) ?? {});
  } catch (_error) {
    return {};
  }
}

function moduleInfo() {
  const module = game?.modules?.get?.(MODULE_ID) ?? null;
  return {
    id: MODULE_ID,
    active: Boolean(module?.active),
    version: module?.version ?? null,
    debugRenderer: isRendererDebugEnabled()
  };
}

function foundryInfo() {
  return {
    version: game?.version ?? game?.release?.version ?? null,
    generation: game?.release?.generation ?? null,
    build: game?.release?.build ?? null
  };
}

function environmentInfo() {
  return {
    worldId: game?.world?.id ?? null,
    worldTitle: game?.world?.title ?? null,
    userAgent: globalThis.navigator?.userAgent ?? null,
    language: globalThis.navigator?.language ?? null
  };
}

function userSummary(user, currentSceneProfile, globalLayouts) {
  return {
    id: user?.id ?? null,
    name: user?.name ?? "",
    active: Boolean(user?.active),
    role: user?.role ?? null,
    isGM: Boolean(user?.isGM),
    hasGlobalLayout: Boolean(globalLayouts?.[user?.id]),
    hasSceneLayout: Boolean(currentSceneProfile?.layouts?.[user?.id])
  };
}

function targetUserSection(targetUserId, currentSceneProfile, globalLayouts, sceneDraft) {
  if (!targetUserId) return null;
  return {
    userId: targetUserId,
    globalLayout: cloneValue(globalLayouts?.[targetUserId] ?? null),
    sceneLayout: cloneValue(currentSceneProfile?.layouts?.[targetUserId] ?? null),
    draftLayout: cloneValue(sceneDraft?.layouts?.[targetUserId] ?? null)
  };
}

export function collectModuleDebugReport(userId, options = {}) {
  const sceneId = options.sceneId ?? canvas?.scene?.id ?? null;
  const targetUserId = userId ?? game?.user?.id ?? null;
  const globalLayouts = safeSetting(SETTINGS_KEYS.PLAYER_LAYOUTS);
  const sceneProfiles = safeSetting(SETTINGS_KEYS.SCENE_PROFILES);
  const sceneCamera = safeSetting(SETTINGS_KEYS.SCENE_CAMERA);
  const currentSceneProfile = sceneId ? cloneValue(sceneProfiles?.[sceneId] ?? null) : null;
  const sceneDraft = sceneId ? cloneValue(getLoadedSceneProfileDraft(sceneId)) : null;
  const users = (game?.users?.contents ?? Array.from(game?.users ?? [])).map((user) => userSummary(user, currentSceneProfile, globalLayouts));

  return {
    timestamp: new Date().toISOString(),
    module: moduleInfo(),
    foundry: foundryInfo(),
    environment: environmentInfo(),
    currentUser: game?.user
      ? {
          id: game.user.id ?? null,
          name: game.user.name ?? "",
          role: game.user.role ?? null,
          isGM: Boolean(game.user.isGM)
        }
      : null,
    scene: {
      id: sceneId,
      name: canvas?.scene?.name ?? null,
      sceneCamera: sceneId ? cloneValue(sceneCamera?.[sceneId] ?? null) : null,
      currentSceneProfile,
      draft: sceneDraft
    },
    settingsSummary: {
      globalLayoutCount: Object.keys(globalLayouts ?? {}).length,
      sceneProfileCount: Object.keys(sceneProfiles ?? {}).length,
      sceneCameraCount: Object.keys(sceneCamera ?? {}).length
    },
    users,
    targetUser: targetUserSection(targetUserId, currentSceneProfile, globalLayouts, sceneDraft),
    rendererSnapshot: options.includeRendererSnapshot === false ? null : dumpRendererDebugSnapshot(targetUserId, options.app)
  };
}

export function dumpModuleDebugReport(userId, options = {}) {
  const report = collectModuleDebugReport(userId, options);
  console.debug(`${MODULE_ID} | debug report`, report);
  return report;
}
