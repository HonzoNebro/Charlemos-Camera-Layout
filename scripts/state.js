const state = {
  app: null,
  loadedSceneDrafts: {}
};

export function setApp(app) {
  state.app = app;
}

export function getApp() {
  return state.app;
}

function cloneValue(value) {
  if (typeof foundry !== "undefined" && foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value ?? {}));
}

export function setLoadedSceneProfileDraft(sceneId, draftLike) {
  if (!sceneId) return null;
  const source =
    draftLike && typeof draftLike === "object" && !Array.isArray(draftLike) && ("layouts" in draftLike || "cameraControlMode" in draftLike)
      ? draftLike
      : { layouts: draftLike };
  const draft = {
    sceneId,
    cameraControlMode: source.cameraControlMode ?? "native",
    layouts: cloneValue(source.layouts ?? {})
  };
  state.loadedSceneDrafts[sceneId] = draft;
  return draft;
}

export function getLoadedSceneProfileDraft(sceneId) {
  if (!sceneId) return null;
  return state.loadedSceneDrafts[sceneId] ?? null;
}

export function clearLoadedSceneProfileDraft(sceneId) {
  if (!sceneId) {
    state.loadedSceneDrafts = {};
    return;
  }
  delete state.loadedSceneDrafts[sceneId];
}
