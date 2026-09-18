import { HOOKS, MODULE_ID } from "./constants.js";
import { getSceneCamera } from "./effective-camera-state.js";
import {
  isCameraViewsApp,
  isLiveCameraVideo,
  observeCameraVideo,
  resolveCameraVideoSource
} from "./camera-video-source.js";

const APPLY_DELAY_MS = 50;
const FRAME_INTERVAL_MS = 1000 / 30;
const FIT_VALUES = new Set(["cover", "contain", "fill"]);
const MESH_NAME = `${MODULE_ID}.scene-background`;

let initialized = false;
let applyTimer = null;
let currentApp = null;
let currentConfiguration = null;
let configurationProvider = () => getSceneCamera();
let nowProvider = () => globalThis.performance?.now?.() ?? Date.now();
let runtime = null;
let pendingSource = null;
let reconcileCount = 0;
let frameUpdateCount = 0;
let lastError = null;
let status = createStatus();

function createStatus(overrides = {}) {
  return {
    state: "disabled",
    sceneId: null,
    playerId: null,
    fit: "cover",
    reason: "no-source",
    ...overrides
  };
}

function statusesMatch(first, second) {
  return ["state", "sceneId", "playerId", "fit", "reason", "videoWidth", "videoHeight"].every(
    (key) => first?.[key] === second?.[key]
  );
}

function updateStatus(nextStatus) {
  const changed = !statusesMatch(status, nextStatus);
  status = nextStatus;
  if (!changed) return;
  console.debug(`${MODULE_ID} | scene background status`, status);
  globalThis.Hooks?.callAll?.(HOOKS.SCENE_BACKGROUND_STATUS_CHANGED, getSceneBackgroundStatus());
}

function normalizeConfiguration(value) {
  const playerId = String(value?.playerId ?? "").trim();
  const fit = FIT_VALUES.has(value?.fit) ? value.fit : "cover";
  return { playerId, fit };
}

function currentSceneId() {
  return globalThis.canvas?.scene?.id ?? null;
}

function readConfiguration() {
  try {
    return normalizeConfiguration(configurationProvider?.());
  } catch (error) {
    recordError(error);
    return normalizeConfiguration(null);
  }
}

function recordError(error) {
  lastError = String(error?.message ?? error ?? "Unknown error");
  console.debug(`${MODULE_ID} | scene background renderer error`, error);
}

function userExists(playerId) {
  const users = globalThis.game?.users;
  if (!users) return true;
  if (typeof users.get === "function") return Boolean(users.get(playerId));
  return Array.from(users).some((user) => String(user?.id ?? "") === playerId);
}

function canvasAvailable() {
  const canvas = globalThis.canvas;
  if (!canvas?.scene || !canvas?.primary?.addChild) return false;
  return canvas.ready !== false;
}

function primarySpriteMeshClass() {
  return globalThis.foundry?.canvas?.primary?.PrimarySpriteMesh ?? globalThis.PrimarySpriteMesh ?? null;
}

function sceneSortLayer() {
  return globalThis.foundry?.canvas?.groups?.PrimaryCanvasGroup?.SORT_LAYERS?.SCENE ?? 0;
}

function sceneRect() {
  const dimensions = globalThis.canvas?.dimensions;
  const rect = dimensions?.sceneRect;
  const x = Number(rect?.x ?? dimensions?.sceneX ?? 0);
  const y = Number(rect?.y ?? dimensions?.sceneY ?? 0);
  const width = Number(rect?.width ?? dimensions?.sceneWidth ?? 0);
  const height = Number(rect?.height ?? dimensions?.sceneHeight ?? 0);
  return { x, y, width, height };
}

function createTexture(videoElement) {
  const pixi = globalThis.PIXI;
  if (!pixi?.BaseImageResource || !pixi?.BaseTexture || !pixi?.Texture) {
    throw new Error("PIXI image resource APIs are unavailable");
  }
  let resource = null;
  let baseTexture = null;
  let texture = null;
  try {
    resource = new pixi.BaseImageResource(videoElement);
    resource.internal = true;
    baseTexture = new pixi.BaseTexture(resource, {
      scaleMode: pixi.SCALE_MODES?.LINEAR
    });
    texture = new pixi.Texture(baseTexture);
    return { resource, baseTexture, texture };
  } catch (error) {
    if (texture && !texture.destroyed) texture.destroy?.(true);
    else if (baseTexture && !baseTexture.destroyed) baseTexture.destroy?.();
    else if (resource && !resource.destroyed) resource.destroy?.();
    throw error;
  }
}

function layerValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isNaN(number) ? fallback : number;
}

function addMeshAboveBackground(mesh) {
  const primary = globalThis.canvas.primary;
  const backgroundIndex = primary.children?.indexOf?.(primary.background) ?? -1;
  if (backgroundIndex >= 0 && typeof primary.addChildAt === "function") {
    return primary.addChildAt(mesh, backgroundIndex + 1);
  }
  return primary.addChild(mesh);
}

function setPoint(point, x, y) {
  if (typeof point?.set === "function") point.set(x, y);
  else if (point) {
    point.x = x;
    point.y = y;
  }
}

function configureMesh(mesh, fit) {
  const rect = sceneRect();
  const background = globalThis.canvas.primary.background;
  setPoint(mesh.anchor, 0.5, 0.5);
  setPoint(mesh.position, rect.x + rect.width / 2, rect.y + rect.height / 2);
  mesh.elevation = layerValue(background?.elevation);
  mesh.sortLayer = layerValue(background?.sortLayer, sceneSortLayer());
  mesh.sort = layerValue(background?.sort);
  mesh.zIndex = layerValue(background?.zIndex);
  mesh.mask = globalThis.canvas?.masks?.scene ?? null;
  mesh.eventMode = "none";
  mesh.interactive = false;
  mesh.hoverFade = false;
  mesh.textureAlphaThreshold = 0;
  mesh.visible = true;
  ["restrictsLight", "restrictsWeather", "occlusionMode"].forEach((property) => {
    if (background && property in background) mesh[property] = background[property];
  });
  if (typeof mesh.resize === "function") mesh.resize(rect.width, rect.height, { fit });
  else {
    mesh.width = rect.width;
    mesh.height = rect.height;
  }
  if (mesh.parent) mesh.parent.sortDirty = true;
}

function frameClock() {
  return nowProvider();
}

function tickerForCanvas() {
  return globalThis.canvas?.app?.ticker ?? globalThis.PIXI?.Ticker?.shared ?? null;
}

function stopTicker(targetRuntime) {
  if (!targetRuntime?.ticker || !targetRuntime?.tick) return;
  targetRuntime.ticker.remove?.(targetRuntime.tick);
  targetRuntime.ticker = null;
  targetRuntime.tick = null;
}

function startTicker(targetRuntime) {
  const ticker = tickerForCanvas();
  if (!ticker?.add) return;
  targetRuntime.lastFrameAt = -Infinity;
  targetRuntime.tick = () => {
    const now = frameClock();
    if (now - targetRuntime.lastFrameAt < FRAME_INTERVAL_MS) return;
    if (!isLiveCameraVideo(targetRuntime.videoElement, targetRuntime.playerId)) {
      if (!targetRuntime.reconcileRequested) {
        targetRuntime.reconcileRequested = true;
        requestSceneBackgroundApply(targetRuntime.app);
      }
      return;
    }
    targetRuntime.reconcileRequested = false;
    try {
      targetRuntime.resource.update();
      targetRuntime.lastFrameAt = now;
      frameUpdateCount += 1;
    } catch (error) {
      recordError(error);
      targetRuntime.reconcileRequested = true;
      requestSceneBackgroundApply(targetRuntime.app);
    }
  };
  targetRuntime.ticker = ticker;
  ticker.add(targetRuntime.tick);
}

function syncResourceDimensions(targetRuntime) {
  const width = Number(targetRuntime.videoElement.videoWidth);
  const height = Number(targetRuntime.videoElement.videoHeight);
  if (Number(targetRuntime.resource.width) === width && Number(targetRuntime.resource.height) === height) return;
  if (typeof targetRuntime.resource.resize === "function") {
    targetRuntime.resource.resize(width, height);
    return;
  }
  targetRuntime.resource.width = width;
  targetRuntime.resource.height = height;
  targetRuntime.baseTexture.setSize?.(width, height);
}

function destroyMesh(targetRuntime) {
  const mesh = targetRuntime?.mesh;
  if (!mesh) return;
  mesh.parent?.removeChild?.(mesh);
  if (!mesh.destroyed) mesh.destroy?.({ children: true, texture: false, baseTexture: false });
}

function destroyTexture(targetRuntime) {
  if (!targetRuntime) return;
  if (!targetRuntime.texture?.destroyed) {
    targetRuntime.texture?.destroy?.(true);
    return;
  }
  if (!targetRuntime.baseTexture?.destroyed) targetRuntime.baseTexture?.destroy?.();
  if (!targetRuntime.resource?.destroyed) targetRuntime.resource?.destroy?.();
}

function cleanupRuntime() {
  if (!runtime) return;
  runtime.stopObserving?.();
  runtime.stopObserving = null;
  stopTicker(runtime);
  destroyMesh(runtime);
  destroyTexture(runtime);
  runtime = null;
}

function cleanupPendingSource() {
  if (!pendingSource) return;
  pendingSource.stopObserving?.();
  pendingSource = null;
}

function observePendingSource(configuration, source) {
  if (pendingSource?.videoElement === source.videoElement && pendingSource.playerId === configuration.playerId) return;
  cleanupPendingSource();
  pendingSource = {
    videoElement: source.videoElement,
    playerId: configuration.playerId,
    stopObserving: observeCameraVideo(source.videoElement, () => requestSceneBackgroundApply(source.app))
  };
}

function setWaiting(configuration, reason) {
  updateStatus(createStatus({
    state: "waiting",
    sceneId: currentSceneId(),
    playerId: configuration.playerId,
    fit: configuration.fit,
    reason
  }));
}

function setUnavailable(configuration) {
  updateStatus(createStatus({
    state: "unavailable",
    sceneId: currentSceneId(),
    playerId: configuration.playerId,
    fit: configuration.fit,
    reason: "missing-user"
  }));
}

function setActive(configuration, videoElement) {
  updateStatus(createStatus({
    state: "active",
    sceneId: currentSceneId(),
    playerId: configuration.playerId,
    fit: configuration.fit,
    reason: null,
    videoWidth: Number(videoElement.videoWidth),
    videoHeight: Number(videoElement.videoHeight)
  }));
}

function createRuntime(configuration, source) {
  const MeshClass = primarySpriteMeshClass();
  if (!MeshClass) throw new Error("PrimarySpriteMesh is unavailable");
  const nextRuntime = {
    ...createTexture(source.videoElement),
    mesh: null,
    app: source.app,
    videoElement: source.videoElement,
    sceneId: currentSceneId(),
    playerId: configuration.playerId,
    fit: configuration.fit,
    stopObserving: null,
    ticker: null,
    tick: null,
    lastFrameAt: -Infinity,
    reconcileRequested: false
  };
  try {
    nextRuntime.mesh = new MeshClass({
      name: MESH_NAME,
      texture: nextRuntime.texture,
      object: globalThis.canvas.primary
    });
    configureMesh(nextRuntime.mesh, configuration.fit);
    addMeshAboveBackground(nextRuntime.mesh);
    configureMesh(nextRuntime.mesh, configuration.fit);
    nextRuntime.stopObserving = observeCameraVideo(source.videoElement, () => requestSceneBackgroundApply(source.app));
    startTicker(nextRuntime);
    return nextRuntime;
  } catch (error) {
    stopTicker(nextRuntime);
    destroyMesh(nextRuntime);
    destroyTexture(nextRuntime);
    throw error;
  }
}

function canReuseRuntime(configuration, videoElement) {
  if (!runtime || runtime.mesh?.destroyed) return false;
  if (runtime.videoElement !== videoElement) return false;
  if (runtime.sceneId !== currentSceneId()) return false;
  return runtime.playerId === configuration.playerId;
}

function reuseRuntime(configuration) {
  runtime.fit = configuration.fit;
  syncResourceDimensions(runtime);
  configureMesh(runtime.mesh, configuration.fit);
  runtime.reconcileRequested = false;
  setActive(configuration, runtime.videoElement);
}

function resolveApplyApp(app) {
  if (isCameraViewsApp(app)) currentApp = app;
  return currentApp;
}

export function applySceneBackgroundNow(app) {
  if (applyTimer !== null) {
    globalThis.clearTimeout?.(applyTimer);
    applyTimer = null;
  }
  reconcileCount += 1;
  const configuration = readConfiguration();
  currentConfiguration = configuration;
  const sceneId = currentSceneId();
  if (!configuration.playerId) {
    cleanupRuntime();
    cleanupPendingSource();
    updateStatus(createStatus({ sceneId }));
    return getSceneBackgroundStatus();
  }
  if (!userExists(configuration.playerId)) {
    cleanupRuntime();
    cleanupPendingSource();
    setUnavailable(configuration);
    return getSceneBackgroundStatus();
  }
  if (!canvasAvailable()) {
    cleanupRuntime();
    cleanupPendingSource();
    setWaiting(configuration, "canvas-unavailable");
    return getSceneBackgroundStatus();
  }
  const source = resolveCameraVideoSource(configuration.playerId, resolveApplyApp(app));
  if (!source.videoElement) {
    cleanupRuntime();
    cleanupPendingSource();
    setWaiting(configuration, "video-unavailable");
    return getSceneBackgroundStatus();
  }
  if (!isLiveCameraVideo(source.videoElement, configuration.playerId)) {
    cleanupRuntime();
    observePendingSource(configuration, source);
    setWaiting(configuration, "video-not-live");
    return getSceneBackgroundStatus();
  }
  if (canReuseRuntime(configuration, source.videoElement)) {
    cleanupPendingSource();
    try {
      reuseRuntime(configuration);
      lastError = null;
    } catch (error) {
      cleanupRuntime();
      recordError(error);
      setWaiting(configuration, "renderer-unavailable");
    }
    return getSceneBackgroundStatus();
  }
  cleanupRuntime();
  cleanupPendingSource();
  try {
    runtime = createRuntime(configuration, source);
    lastError = null;
    setActive(configuration, source.videoElement);
  } catch (error) {
    cleanupRuntime();
    recordError(error);
    setWaiting(configuration, "renderer-unavailable");
  }
  return getSceneBackgroundStatus();
}

export function requestSceneBackgroundApply(app) {
  if (isCameraViewsApp(app)) currentApp = app;
  if (applyTimer !== null) globalThis.clearTimeout?.(applyTimer);
  applyTimer = globalThis.setTimeout?.(() => {
    applyTimer = null;
    applySceneBackgroundNow(currentApp);
  }, APPLY_DELAY_MS) ?? null;
}

function handleCanvasTearDown() {
  if (applyTimer !== null) {
    globalThis.clearTimeout?.(applyTimer);
    applyTimer = null;
  }
  cleanupRuntime();
  cleanupPendingSource();
  const configuration = currentConfiguration ?? readConfiguration();
  if (configuration.playerId) setWaiting(configuration, "canvas-unavailable");
  else updateStatus(createStatus({ sceneId: currentSceneId() }));
}

function registerHooks() {
  const hooks = globalThis.Hooks;
  if (!hooks?.on) return;
  hooks.on("canvasReady", () => requestSceneBackgroundApply());
  hooks.on("canvasTearDown", handleCanvasTearDown);
  hooks.on("renderApplicationV2", (app) => {
    if (isCameraViewsApp(app)) requestSceneBackgroundApply(app);
  });
  hooks.on("rtcSettingsChanged", () => requestSceneBackgroundApply());
  hooks.on("userConnected", () => requestSceneBackgroundApply());
}

export function initializeSceneBackgroundRenderer(options = {}) {
  if (typeof options.getConfiguration === "function") configurationProvider = options.getConfiguration;
  if (typeof options.now === "function") nowProvider = options.now;
  if (!initialized) {
    initialized = true;
    registerHooks();
  }
  requestSceneBackgroundApply();
}

export function cleanupSceneBackground() {
  if (applyTimer !== null) {
    globalThis.clearTimeout?.(applyTimer);
    applyTimer = null;
  }
  cleanupRuntime();
  cleanupPendingSource();
  currentConfiguration = null;
  currentApp = null;
  updateStatus(createStatus({ sceneId: currentSceneId() }));
}

export function getSceneBackgroundStatus() {
  return { ...status };
}

export function dumpSceneBackgroundSnapshot() {
  return {
    ...getSceneBackgroundStatus(),
    initialized,
    hasMesh: Boolean(runtime?.mesh && !runtime.mesh.destroyed),
    hasVideo: Boolean(runtime?.videoElement),
    hasPendingVideo: Boolean(pendingSource?.videoElement),
    hasTicker: Boolean(runtime?.ticker),
    reconcileCount,
    frameUpdateCount,
    lastError
  };
}
