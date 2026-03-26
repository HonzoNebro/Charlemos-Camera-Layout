import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { composeTransform, nameStyle, overlayStyle } from "./camera-layout-style.js";
import { buildCameraViewStyle } from "./camera-style-service.js";
import { getSceneCameraControlMode, getSceneProfileLayout, sceneProfileEnabled } from "./scene-camera.js";

const RENDER_DELAY_MS = 50;
const ALTERNATE_NAME_TICK_MS = 1000;
const FOUNDRY_AVATAR_SELECTOR = ["img.user-avatar", ".user-avatar img", "img.avatar"].join(", ");
const FOUNDRY_FALLBACK_SELECTOR = [".user-avatar", ".camera-fallback", ".video-fallback", ".webrtc-fallback", ".no-video"].join(", ");
const DEBUG_LOG_THROTTLE_MS = 1200;

let renderTimer = null;
let alternateNameTicker = null;
const debugTimestamps = new Map();

function isCameraViewsApp(app) {
  if (!app) return false;
  if (app.constructor?.name === "CameraViews") return true;
  return typeof app.getUserCameraView === "function" && typeof app.getUserVideoElement === "function";
}

function getCameraViewsApp(app) {
  if (isCameraViewsApp(app)) return app;
  if (isCameraViewsApp(ui?.webrtc)) return ui.webrtc;
  return null;
}

function getViewElement(app, userId) {
  if (typeof app.getUserCameraView === "function") return app.getUserCameraView(userId);
  return document.querySelector(`.camera-view[data-user="${userId}"], .camera-view[data-user-id="${userId}"]`);
}

function getVideoElement(app, userId, viewElement) {
  if (typeof app.getUserVideoElement === "function") return app.getUserVideoElement(userId);
  return viewElement?.querySelector("video");
}

function getOrCreateOverlay(viewElement) {
  let overlay = viewElement.querySelector(".charlemos-camera-overlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.className = "charlemos-camera-overlay";
  viewElement.appendChild(overlay);
  return overlay;
}

function getOrCreateName(viewElement) {
  let name = viewElement.querySelector(".charlemos-camera-name");
  if (name) return name;
  name = document.createElement("div");
  name.className = "charlemos-camera-name";
  viewElement.appendChild(name);
  return name;
}

function getOrCreateCropMask(viewElement, side) {
  let mask = viewElement.querySelector(`.charlemos-crop-mask.charlemos-crop-${side}`);
  if (mask) return mask;
  mask = document.createElement("div");
  mask.className = `charlemos-crop-mask charlemos-crop-${side}`;
  viewElement.appendChild(mask);
  return mask;
}

function assignStyle(element, style) {
  Object.entries(style).forEach(([key, value]) => {
    element.style[key] = value ?? "";
  });
}

function rectsOverlap(a, b) {
  if (!a || !b) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function nearestShiftContainer(element, viewElement) {
  if (!element) return null;
  const container = element.closest(
    [
      ".camera-view-control-bar",
      ".camera-view-controls",
      ".camera-controls",
      ".video-controls",
      ".webrtc-controls",
      ".control-bar",
      ".controls",
      ".dock-control",
      ".dock-controls",
      ".toolbar",
      ".hud",
      ".camera-view-header"
    ].join(", ")
  );
  if (container && container !== viewElement && viewElement.contains(container)) return container;
  if (element.parentElement && element.parentElement !== viewElement) return element.parentElement;
  return element;
}

function setControlShift(target, direction, shiftPx) {
  if (!target?.style || !target?.dataset) return;
  if (target.dataset.charlemosNameShifted !== "1") {
    target.dataset.charlemosNameShifted = "1";
    target.dataset.charlemosNameShiftMarginTop = target.style.marginTop ?? "";
    target.dataset.charlemosNameShiftMarginBottom = target.style.marginBottom ?? "";
  }
  const baseTop = target.dataset.charlemosNameShiftMarginTop ?? "";
  const baseBottom = target.dataset.charlemosNameShiftMarginBottom ?? "";
  if (direction === "down") {
    target.style.marginTop = baseTop ? `calc(${baseTop} + ${shiftPx}px)` : `${shiftPx}px`;
    target.style.marginBottom = baseBottom;
    return;
  }
  target.style.marginBottom = baseBottom ? `calc(${baseBottom} + ${shiftPx}px)` : `${shiftPx}px`;
  target.style.marginTop = baseTop;
}

function setControlTranslateY(target, shiftPx) {
  if (!target?.style || !target?.dataset) return;
  if (target.dataset.charlemosNameTranslateApplied !== "1") {
    target.dataset.charlemosNameTranslateApplied = "1";
    target.dataset.charlemosNameTranslateBase = target.style.transform ?? "";
  }
  const base = target.dataset.charlemosNameTranslateBase ?? "";
  const translate = `translateY(-${shiftPx}px)`;
  target.style.transform = base ? `${base} ${translate}` : translate;
}

function visibleRect(element) {
  if (!element?.getBoundingClientRect) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}

function resetNameplateControlAvoidance(viewElement) {
  viewElement.querySelectorAll("[data-charlemos-name-shifted='1']").forEach((element) => {
    if (!element?.style || !element?.dataset) return;
    element.style.marginTop = element.dataset.charlemosNameShiftMarginTop ?? "";
    element.style.marginBottom = element.dataset.charlemosNameShiftMarginBottom ?? "";
    delete element.dataset.charlemosNameShifted;
    delete element.dataset.charlemosNameShiftMarginTop;
    delete element.dataset.charlemosNameShiftMarginBottom;
  });
  viewElement.querySelectorAll("[data-charlemos-name-translate-applied='1']").forEach((element) => {
    if (!element?.style || !element?.dataset) return;
    element.style.transform = element.dataset.charlemosNameTranslateBase ?? "";
    delete element.dataset.charlemosNameTranslateApplied;
    delete element.dataset.charlemosNameTranslateBase;
  });
}

function controlShiftTargets(viewElement, nameElement) {
  const selectors = [
    "button",
    "[role='button']",
    "a[data-action]",
    "[data-action]",
    "[data-tooltip]",
    "[aria-label]",
    "[class*='control']",
    "[class*='controls']",
    "[class*='dock']"
  ];
  const nameRect = nameElement?.getBoundingClientRect?.();
  if (!nameRect) return [];
  const targets = new Set();
  viewElement.querySelectorAll(selectors.join(", ")).forEach((candidate) => {
    if (!(candidate instanceof Element)) return;
    if (candidate === nameElement) return;
    if (candidate === viewElement) return;
    if (candidate.closest(".charlemos-camera-name, .charlemos-camera-overlay, .charlemos-crop-mask")) return;
    const rect = candidate.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    if (!rectsOverlap(rect, nameRect)) return;
    const target = nearestShiftContainer(candidate, viewElement);
    if (!target || target === viewElement || target === nameElement) return;
    if (target.closest(".charlemos-camera-name, .charlemos-camera-overlay, .charlemos-crop-mask")) return;
    targets.add(target);
  });
  return Array.from(targets);
}

function edgeControlTargets(viewElement, position) {
  if (position === "top") {
    const topTargets = viewElement.querySelectorAll(
      [
        ".control-bar.left",
        ".control-bar",
        ".notification-bar.right",
        ".notification-bar",
        ".camera-view-header"
      ].join(", ")
    );
    return Array.from(topTargets).filter((target) => target !== viewElement);
  }
  const bottomContainer = viewElement.querySelector(".bottom");
  if (bottomContainer) return [bottomContainer];
  const bottomControls = viewElement.querySelectorAll([".user-controls", ".camera-view-control-bar", ".camera-view-controls"].join(", "));
  return Array.from(bottomControls).filter((target) => target !== viewElement);
}

function applyNativeNameControlAvoidance(viewElement) {
  const bottom = viewElement.querySelector(".bottom");
  if (!bottom) return;
  const nativeName = bottom.querySelector(".player-name");
  const userControls = bottom.querySelector(".user-controls");
  const nameRect = visibleRect(nativeName);
  const controlsRect = visibleRect(userControls);
  if (!nameRect || !controlsRect) return;
  const overlap = controlsRect.bottom - nameRect.top;
  if (overlap <= 0) return;
  const shiftPx = Math.ceil(overlap + 4);
  setControlTranslateY(userControls, shiftPx);
}

function applyNameplateControlAvoidance(viewElement, nameElement, position) {
  resetNameplateControlAvoidance(viewElement);
  if (!nameElement || nameElement.style.display === "none") {
    applyNativeNameControlAvoidance(viewElement);
    return;
  }
  const nameRect = visibleRect(nameElement);
  if (!nameRect || nameRect.height <= 0) return;
  const shiftPx = Math.ceil(nameRect.height + 4);
  const direction = position === "top" ? "down" : "up";
  const directTargets = edgeControlTargets(viewElement, position);
  const targets = directTargets.length ? directTargets : controlShiftTargets(viewElement, nameElement);
  targets.forEach((target) => {
    setControlShift(target, direction, shiftPx);
  });
}

export function isRendererDebugEnabled() {
  try {
    return Boolean(game?.settings?.get(MODULE_ID, SETTINGS_KEYS.DEBUG_RENDERER));
  } catch (_error) {
    return false;
  }
}

export function isFrameOverlayPath(imageUrl) {
  const text = String(imageUrl ?? "").toLowerCase();
  if (!text) return false;
  return text.includes("/frame") || text.includes("/frames/");
}

export function applyFrameOverlayFallbackStyle(element, overlay) {
  if (!element?.style) return;
  const overlayConfig =
    overlay && typeof overlay === "object"
      ? overlay
      : {
          imageUrl: overlay
        };
  const imageUrl = overlayConfig?.imageUrl;
  if (!isFrameOverlayPath(imageUrl)) return;
  const fitMode = String(overlayConfig?.fitMode ?? "auto").trim();
  const anchor = String(overlayConfig?.anchor ?? "center").trim();
  const hasExplicitFitMode = fitMode !== "" && fitMode !== "auto";
  const hasExplicitAnchor = anchor !== "" && anchor !== "center";
  if (hasExplicitFitMode || hasExplicitAnchor) return;
  element.style.backgroundSize = "100% 100%";
  element.style.backgroundPosition = "center";
  element.style.backgroundRepeat = "no-repeat";
  if (!element.style.mixBlendMode) element.style.mixBlendMode = "screen";
}

function shouldLogDebug(key) {
  if (!isRendererDebugEnabled()) return false;
  const now = Date.now();
  const last = debugTimestamps.get(key) ?? 0;
  if (now - last < DEBUG_LOG_THROTTLE_MS) return false;
  debugTimestamps.set(key, now);
  return true;
}

function videoDebugState(videoElement) {
  if (!videoElement) {
    return {
      present: false
    };
  }
  const srcObject = videoElement.srcObject;
  const tracks =
    srcObject && typeof srcObject.getVideoTracks === "function"
      ? srcObject.getVideoTracks().map((track) => ({ readyState: track.readyState, enabled: track.enabled, muted: track.muted }))
      : [];
  return {
    present: true,
    tag: videoElement.tagName ?? "",
    className: String(videoElement.className ?? ""),
    readyState: videoElement.readyState,
    paused: videoElement.paused,
    ended: videoElement.ended,
    videoWidth: videoElement.videoWidth,
    videoHeight: videoElement.videoHeight,
    hasSrcObject: Boolean(srcObject),
    trackCount: tracks.length,
    tracks
  };
}

function viewDebugState(viewElement) {
  if (!viewElement) {
    return {
      present: false
    };
  }
  const avatars = Array.from(viewElement.querySelectorAll(FOUNDRY_AVATAR_SELECTOR)).map((element) => ({
    tag: element.tagName ?? "",
    className: String(element.className ?? ""),
    display: element.style?.display ?? ""
  }));
  return {
    present: true,
    className: String(viewElement.className ?? ""),
    childCount: viewElement.childElementCount ?? 0,
    avatarCount: avatars.length,
    avatars,
    layers: Array.from(viewElement.children ?? []).map((element) => ({
      tag: element.tagName ?? "",
      className: String(element.className ?? ""),
      display: element.style?.display ?? "",
      zIndex: element.style?.zIndex ?? "",
      hasVideo: Boolean(element.querySelector?.("video"))
    }))
  };
}

function layoutDebugState(layout) {
  if (!layout) {
    return {
      present: false
    };
  }
  return {
    present: true,
    hasTransform: Boolean(layout.transform),
    hasFilter: Boolean(layout.filter),
    hasClipPath: Boolean(layout.clipPath),
    overlayEnabled: Boolean(layout.overlay?.enabled),
    overlayImage: layout.overlay?.imageUrl ?? null,
    overlayOpacity: layout.overlay?.opacity ?? null,
    overlayFitMode: layout.overlay?.fitMode ?? "auto",
    overlayAnchor: layout.overlay?.anchor ?? "center",
    crop: layout.crop ?? null
  };
}

function logRendererDebug(stage, userId, sceneEnabled, viewElement, videoElement, layout, extra = {}) {
  const key = `${userId}:${stage}`;
  if (!shouldLogDebug(key)) return;
  console.debug(`${MODULE_ID} | renderer debug`, {
    stage,
    userId,
    sceneEnabled,
    liveVideo: hasLiveVideoFeed(videoElement),
    video: videoDebugState(videoElement),
    view: viewDebugState(viewElement),
    layout: layoutDebugState(layout),
    extra,
    diagnostics: collectRendererDiagnostics(viewElement, videoElement)
  });
}

function hasLiveVideoFeed(videoElement) {
  if (!videoElement) return false;
  return Number(videoElement.videoWidth) > 0 && Number(videoElement.videoHeight) > 0 && videoElement.ended !== true;
}

function elementRect(element) {
  if (!element?.getBoundingClientRect) return null;
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

function elementMetrics(element) {
  if (!element) {
    return {
      present: false
    };
  }
  const computed = typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(element) : null;
  return {
    present: true,
    tag: element.tagName ?? "",
    id: String(element.id ?? ""),
    className: String(element.className ?? ""),
    inlineStyle: element.getAttribute?.("style") ?? "",
    display: computed?.display ?? "",
    visibility: computed?.visibility ?? "",
    opacity: computed?.opacity ?? "",
    position: computed?.position ?? "",
    zIndex: computed?.zIndex ?? "",
    pointerEvents: computed?.pointerEvents ?? "",
    width: computed?.width ?? "",
    height: computed?.height ?? "",
    rect: elementRect(element)
  };
}

function firstMatch(root, selector) {
  return root?.querySelector(selector) ?? null;
}

function cameraContainer(viewElement) {
  return firstMatch(viewElement, ".video-container, .camera-container-popout, .camera-container");
}

function resizeHandle(viewElement) {
  return firstMatch(viewElement, ".window-resize-handle, .window-resizable-handle, .ui-resizable-handle");
}

function viewChildrenMetrics(viewElement) {
  return Array.from(viewElement?.children ?? []).map((element) => ({
    tag: element.tagName ?? "",
    className: String(element.className ?? ""),
    display: element.style?.display ?? "",
    zIndex: element.style?.zIndex ?? "",
    rect: elementRect(element),
    hasVideo: Boolean(element.querySelector?.("video"))
  }));
}

function collectRendererDiagnostics(viewElement, videoElement) {
  return {
    view: elementMetrics(viewElement),
    container: elementMetrics(cameraContainer(viewElement)),
    video: elementMetrics(videoElement),
    overlay: elementMetrics(firstMatch(viewElement, ".charlemos-camera-overlay")),
    name: elementMetrics(firstMatch(viewElement, ".charlemos-camera-name")),
    handle: elementMetrics(resizeHandle(viewElement)),
    avatar: elementMetrics(firstMatch(viewElement, ".user-avatar, img.user-avatar, img.avatar")),
    children: viewChildrenMetrics(viewElement)
  };
}

function isFallbackWrapper(element) {
  if (typeof Element !== "undefined" && !(element instanceof Element)) return false;
  const className = String(element.className ?? "").toLowerCase();
  const isCandidate =
    className.includes("avatar") ||
    className.includes("fallback") ||
    className.includes("no-video") ||
    className.includes("camera-off") ||
    className.includes("placeholder") ||
    className.includes("poster") ||
    className.includes("thumbnail");
  if (!isCandidate) return false;
  if (element.querySelector("video")) return false;
  return true;
}

function restoreElementVisibility(element) {
  if (!element?.style) return;
  element.style.display = "";
  element.style.visibility = "";
  element.style.opacity = "";
  element.style.pointerEvents = "";
  if (element.dataset) {
    delete element.dataset.charlemosHidden;
  }
}

function hideElementPreservingLayout(element) {
  if (!element?.style) return;
  element.style.display = "";
  element.style.visibility = "hidden";
  element.style.opacity = "0";
  element.style.pointerEvents = "none";
  if (element.dataset) {
    element.dataset.charlemosHidden = "1";
  }
}

function collectAvatarTargets(viewElement) {
  const targets = [];
  const seen = new Set();
  const avatars = viewElement.querySelectorAll(FOUNDRY_AVATAR_SELECTOR);
  avatars.forEach((element) => {
    if (String(element?.tagName ?? "").toUpperCase() !== "IMG") return;
    if (seen.has(element)) return;
    seen.add(element);
    targets.push(element);
  });
  const fallbacks = viewElement.querySelectorAll(FOUNDRY_FALLBACK_SELECTOR);
  fallbacks.forEach((element) => {
    if (!isFallbackWrapper(element) && String(element?.tagName ?? "").toUpperCase() !== "IMG") return;
    if (seen.has(element)) return;
    seen.add(element);
    targets.push(element);
  });
  return { targets, avatars, fallbacks };
}

export function syncFoundryAvatarVisibility(viewElement, videoElement, forceShow = false) {
  if (!viewElement?.querySelectorAll) return;
  const hide = !forceShow && hasLiveVideoFeed(videoElement);
  const { targets, avatars, fallbacks } = collectAvatarTargets(viewElement);
  const hasMarkedTargets = targets.some((element) => element?.dataset?.charlemosHidden === "1");
  if (!forceShow && !hide && !hasMarkedTargets) {
    logRendererDebug("avatar-skip", "unknown", null, viewElement, videoElement, null, {
      hide,
      avatarCount: avatars.length,
      fallbackCount: fallbacks.length
    });
    return;
  }
  targets.forEach((element) => {
    if (forceShow) {
      restoreElementVisibility(element);
      return;
    }
    if (hide) {
      hideElementPreservingLayout(element);
      return;
    }
    restoreElementVisibility(element);
  });
  logRendererDebug("avatar-apply", "unknown", null, viewElement, videoElement, null, {
    hide,
    avatarCount: avatars.length,
    fallbackCount: fallbacks.length,
    targetCount: targets.length,
    hasMarkedTargets
  });
}

export function videoStyle(layout) {
  return {
    transform: composeTransform(layout?.transform, layout?.geometry),
    filter: layout?.filter ?? "",
    clipPath: layout?.clipPath ?? "",
    borderRadius: layout?.geometry?.borderRadius ?? "",
    display: "block",
    visibility: "visible",
    opacity: "1",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    backgroundColor: "transparent"
  };
}

function resolveUserColor(user) {
  if (!user) return "";
  if (typeof user.color === "string") return user.color;
  if (typeof user.cssColor === "string") return user.cssColor;
  if (typeof user.color?.css === "string") return user.color.css;
  if (typeof user.color?.toString === "function") return user.color.toString();
  return "";
}

function applyName(viewElement, layout, user) {
  const element = getOrCreateName(viewElement);
  const style = nameStyle(layout, {
    userName: user?.name ?? "",
    characterName: user?.character?.name ?? user?.name ?? "",
    userColor: resolveUserColor(user),
    nowMs: Date.now()
  });
  element.textContent = style.text ?? "";
  element.classList.toggle("charlemos-name-top", style.position === "top");
  element.classList.toggle("charlemos-name-bottom", style.position !== "top");
  assignStyle(element, {
    display: style.display,
    color: style.color,
    fontFamily: style.fontFamily,
    textAlign: style.textAlign,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle
  });
  applyNameplateControlAvoidance(viewElement, element, style.position);
}

function applyCropMasks(viewElement, layout) {
  const top = layout?.crop?.top;
  const right = layout?.crop?.right;
  const bottom = layout?.crop?.bottom;
  const left = layout?.crop?.left;
  const masks = {
    top: getOrCreateCropMask(viewElement, "top"),
    right: getOrCreateCropMask(viewElement, "right"),
    bottom: getOrCreateCropMask(viewElement, "bottom"),
    left: getOrCreateCropMask(viewElement, "left")
  };
  assignStyle(masks.top, { display: top ? "block" : "none", top: "0", left: "0", right: "0", height: top || "0" });
  assignStyle(masks.right, { display: right ? "block" : "none", top: "0", right: "0", bottom: "0", width: right || "0" });
  assignStyle(masks.bottom, { display: bottom ? "block" : "none", left: "0", right: "0", bottom: "0", height: bottom || "0" });
  assignStyle(masks.left, { display: left ? "block" : "none", top: "0", left: "0", bottom: "0", width: left || "0" });
}

function applyOverlay(viewElement, layout) {
  const element = getOrCreateOverlay(viewElement);
  const style = overlayStyle(layout);
  assignStyle(element, style);
  applyFrameOverlayFallbackStyle(element, layout?.overlay);
}

function clearManagedViewGeometry(viewElement) {
  if (!viewElement?.dataset || viewElement.dataset.charlemosGeometryManaged !== "1") return;
  assignStyle(viewElement, {
    position: "",
    top: "",
    left: "",
    width: "",
    height: ""
  });
  delete viewElement.dataset.charlemosGeometryManaged;
}

export function syncManagedViewGeometry(viewElement, layout, applyGeometry) {
  if (!viewElement?.style) return;
  if (!applyGeometry) {
    clearManagedViewGeometry(viewElement);
    return;
  }
  assignStyle(viewElement, buildCameraViewStyle(layout));
  if (viewElement.dataset) viewElement.dataset.charlemosGeometryManaged = "1";
}

export function syncGeometryInteractionMode(viewElement, applyGeometry) {
  if (!viewElement?.classList) return;
  viewElement.classList.toggle("charlemos-geometry-module", applyGeometry);
  viewElement.classList.toggle("charlemos-geometry-native", !applyGeometry);
}

function applyViewStyle(viewElement, layout, applyGeometry) {
  viewElement.classList.add("charlemos-camera-view");
  viewElement.classList.remove("charlemos-direct-edit");
  syncGeometryInteractionMode(viewElement, applyGeometry);
  assignStyle(viewElement, {
    borderRadius: layout?.geometry?.borderRadius ?? "",
    background: "transparent",
    backgroundColor: "transparent",
    outline: "",
    cursor: ""
  });
  syncManagedViewGeometry(viewElement, layout, applyGeometry);
}

function applyVideoStyle(videoElement, layout) {
  assignStyle(videoElement, videoStyle(layout));
}

function resetViewStyle(viewElement, videoElement) {
  resetNameplateControlAvoidance(viewElement);
  viewElement.classList.remove("charlemos-camera-view");
  viewElement.classList.remove("charlemos-direct-edit");
  viewElement.classList.remove("charlemos-geometry-module");
  viewElement.classList.remove("charlemos-geometry-native");
  assignStyle(viewElement, {
    borderRadius: "",
    background: "",
    backgroundColor: "",
    outline: "",
    cursor: ""
  });
  clearManagedViewGeometry(viewElement);
  assignStyle(videoElement, {
    transform: "",
    filter: "",
    clipPath: "",
    borderRadius: "",
    display: "",
    visibility: "",
    opacity: "",
    backgroundColor: "",
    objectFit: ""
  });
}

function removeCharlemosNodes(viewElement) {
  viewElement
    .querySelectorAll(
      ".charlemos-camera-overlay, .charlemos-camera-name, .charlemos-crop-mask, .charlemos-aspect-badge, .charlemos-resize-handle"
    )
    .forEach((node) => {
      node.remove();
    });
}

function applyPlayerLayout(app, user) {
  const userId = user.id;
  const viewElement = getViewElement(app, userId);
  if (!viewElement) {
    logRendererDebug("missing-view", userId, sceneProfileEnabled(), null, null, null);
    return;
  }
  const videoElement = getVideoElement(app, userId, viewElement);
  if (!videoElement) {
    logRendererDebug("missing-video", userId, sceneProfileEnabled(), viewElement, null, null);
    return;
  }
  const enabled = sceneProfileEnabled();
  if (!enabled) {
    logRendererDebug("scene-disabled", userId, enabled, viewElement, videoElement, null);
    removeCharlemosNodes(viewElement);
    resetViewStyle(viewElement, videoElement);
    return;
  }
  const layout = getSceneProfileLayout(userId);
  if (!layout) {
    logRendererDebug("missing-layout", userId, enabled, viewElement, videoElement, null);
    removeCharlemosNodes(viewElement);
    resetViewStyle(viewElement, videoElement);
    return;
  }
  const cameraControlMode = getSceneCameraControlMode();
  const applyGeometry = cameraControlMode === "module";
  logRendererDebug("before-apply", userId, enabled, viewElement, videoElement, layout);
  applyViewStyle(viewElement, layout, applyGeometry);
  applyVideoStyle(videoElement, layout);
  syncFoundryAvatarVisibility(viewElement, videoElement);
  applyOverlay(viewElement, layout);
  applyName(viewElement, layout, user);
  applyCropMasks(viewElement, layout);
  const overlayElement = viewElement.querySelector(".charlemos-camera-overlay");
  const videoComputed = typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(videoElement) : null;
  logRendererDebug("after-apply", userId, enabled, viewElement, videoElement, layout, {
    videoInlineStyle: videoElement.getAttribute?.("style") ?? "",
    viewInlineStyle: viewElement.getAttribute?.("style") ?? "",
    overlayInlineStyle: overlayElement?.getAttribute?.("style") ?? "",
    videoComputedDisplay: videoComputed?.display ?? "",
    videoComputedVisibility: videoComputed?.visibility ?? "",
    videoComputedOpacity: videoComputed?.opacity ?? "",
    videoComputedZIndex: videoComputed?.zIndex ?? ""
  });
}

function applyAll(app) {
  game.users.forEach((user) => applyPlayerLayout(app, user));
  if (isRendererDebugEnabled()) {
    console.debug(`${MODULE_ID} | camera layouts applied`);
  }
}

function clearRenderTimer() {
  if (!renderTimer) return;
  window.clearTimeout(renderTimer);
  renderTimer = null;
}

function queueApply(app) {
  clearRenderTimer();
  renderTimer = window.setTimeout(() => {
    const cameraApp = getCameraViewsApp(app);
    if (!cameraApp) return;
    applyAll(cameraApp);
  }, RENDER_DELAY_MS);
}

export function applyCameraLayoutsNow(app) {
  const cameraApp = getCameraViewsApp(app);
  if (!cameraApp) return;
  applyAll(cameraApp);
}

export function dumpRendererDebugSnapshot(userId, app) {
  const cameraApp = getCameraViewsApp(app);
  if (!cameraApp) return null;
  const targetUserId = userId ?? game.user?.id ?? null;
  if (!targetUserId) return null;
  const viewElement = getViewElement(cameraApp, targetUserId);
  const videoElement = viewElement ? getVideoElement(cameraApp, targetUserId, viewElement) : null;
  const enabled = sceneProfileEnabled();
  const layout = enabled ? getSceneProfileLayout(targetUserId) : null;
  const snapshot = {
    stage: "snapshot",
    userId: targetUserId,
    sceneEnabled: enabled,
    liveVideo: hasLiveVideoFeed(videoElement),
    video: videoDebugState(videoElement),
    view: viewDebugState(viewElement),
    layout: layoutDebugState(layout),
    diagnostics: collectRendererDiagnostics(viewElement, videoElement)
  };
  console.debug(`${MODULE_ID} | renderer snapshot`, snapshot);
  return snapshot;
}

function registerRenderHook() {
  Hooks.on("renderApplicationV2", (app) => {
    if (!isCameraViewsApp(app)) return;
    queueApply(app);
  });
}

function registerRtcHook() {
  Hooks.on("rtcSettingsChanged", () => {
    queueApply();
  });
}

function registerUserHook() {
  Hooks.on("userConnected", () => {
    queueApply();
  });
}

function hasAlternateNameLayouts() {
  if (!sceneProfileEnabled()) return false;
  return game.users.some((user) => {
    const layout = getSceneProfileLayout(user.id);
    return layout?.nameStyle?.source === "alternate";
  });
}

function startAlternateNameTicker() {
  if (alternateNameTicker) return;
  alternateNameTicker = window.setInterval(() => {
    if (!hasAlternateNameLayouts()) return;
    queueApply();
  }, ALTERNATE_NAME_TICK_MS);
}

export function initializeLiveCameraRenderer() {
  registerRenderHook();
  registerRtcHook();
  registerUserHook();
  startAlternateNameTicker();
  queueApply();
}
