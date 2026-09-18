const CAMERA_VIEW_SELECTOR = ".camera-view[data-user], .camera-view[data-user-id]";
const VIDEO_EVENTS = ["loadedmetadata", "playing", "resize", "emptied", "ended", "stalled", "abort", "loadstart"];
const TRACK_EVENTS = ["ended", "mute", "unmute"];

function asQueryableElement(value) {
  if (!value) return null;
  if (typeof value.querySelector === "function" || typeof value.matches === "function") return value;
  try {
    const first = typeof value.get === "function" ? value.get(0) : value[0];
    if (typeof first?.querySelector === "function" || typeof first?.matches === "function") return first;
  } catch {
  }
  return null;
}

function applicationElement(app) {
  try {
    return asQueryableElement(app?.element);
  } catch {
    return null;
  }
}

function cameraViewUserId(viewElement) {
  return String(viewElement?.dataset?.user ?? viewElement?.dataset?.userId ?? "");
}

function isCameraViewElement(element) {
  try {
    if (element?.matches?.(".camera-view")) return true;
  } catch {
  }
  return element?.classList?.contains?.("camera-view") === true;
}

function cameraViewsIn(container) {
  if (!container) return [];
  const views = [];
  if (isCameraViewElement(container)) views.push(container);
  try {
    if (typeof container.querySelectorAll === "function") {
      views.push(...Array.from(container.querySelectorAll(".camera-view") ?? []));
    } else {
      const view = container.querySelector?.(".camera-view");
      if (view) views.push(view);
    }
  } catch {
  }
  return Array.from(new Set(views));
}

function findCameraView(container, userId, allowUnattributed = false) {
  const views = cameraViewsIn(container);
  const targetUserId = String(userId ?? "");
  const matching = views.find((view) => cameraViewUserId(view) === targetUserId);
  if (matching) return matching;
  if (!allowUnattributed) return null;
  return views.find((view) => !cameraViewUserId(view)) ?? null;
}

function cameraPopoutMatchesUser(app, userId) {
  const appUserId = String(app?.user?.id ?? "");
  return Boolean(appUserId) && appUserId === String(userId ?? "");
}

function findVideoElement(container) {
  try {
    return container?.querySelector?.("video") ?? null;
  } catch {
    return null;
  }
}

export function isCameraViewsApp(app) {
  if (!app) return false;
  if (app.constructor?.name === "CameraViews") return true;
  return typeof app.getUserCameraView === "function" && typeof app.getUserVideoElement === "function";
}

export function isCameraPopoutApp(app) {
  if (!app || isCameraViewsApp(app)) return false;
  if (app.constructor?.name === "CameraPopout") return true;
  if (!app.user?.id) return false;
  if (isCameraViewsApp(app.parent)) return true;
  return Boolean(findCameraView(applicationElement(app), app.user.id, true));
}

export function resolveCameraViewsApp(app) {
  if (isCameraViewsApp(app)) return app;
  if (isCameraViewsApp(globalThis.ui?.webrtc)) return globalThis.ui.webrtc;
  return null;
}

function findCameraViewInDocument(userId, documentElement = globalThis.document) {
  try {
    const views = documentElement?.querySelectorAll?.(CAMERA_VIEW_SELECTOR) ?? [];
    return Array.from(views).find((view) => cameraViewUserId(view) === String(userId)) ?? null;
  } catch {
    return null;
  }
}

function resolveCameraPopoutViewElement(userId, app) {
  if (!cameraPopoutMatchesUser(app, userId)) return null;
  const root = applicationElement(app);
  const localView = findCameraView(root, userId, true);
  if (localView) return localView;
  if (!root?.ownerDocument) return null;
  return findCameraViewInDocument(userId, root.ownerDocument);
}

export function resolveCameraViewElement(userId, app) {
  if (isCameraPopoutApp(app) && cameraPopoutMatchesUser(app, userId)) {
    return resolveCameraPopoutViewElement(userId, app);
  }
  const cameraViews = resolveCameraViewsApp(app);
  try {
    const view = cameraViews?.getUserCameraView?.(userId);
    if (view) return view;
  } catch {
  }
  return findCameraViewInDocument(userId);
}

export function resolveEditorCameraView(userId) {
  const app = resolveCameraViewsApp();
  const popout = Array.from(app?.popouts ?? []).find((item) => item?.user?.id === userId && item.rendered !== false);
  return resolveCameraViewElement(userId, popout ?? app);
}

export function resolveCameraVideoElement(userId, app, viewElement) {
  if (isCameraPopoutApp(app) && cameraPopoutMatchesUser(app, userId)) {
    const view = viewElement ?? resolveCameraPopoutViewElement(userId, app);
    const viewVideo = findVideoElement(view);
    if (viewVideo) return viewVideo;
    return findVideoElement(applicationElement(app));
  }
  const cameraViews = resolveCameraViewsApp(app);
  try {
    const video = cameraViews?.getUserVideoElement?.(userId);
    if (video) return video;
  } catch {
  }
  const view = viewElement ?? resolveCameraViewElement(userId, cameraViews);
  return findVideoElement(view);
}

export function resolveCameraVideoSource(userId, app) {
  const sourceApp = isCameraPopoutApp(app) && cameraPopoutMatchesUser(app, userId)
    ? app
    : resolveCameraViewsApp(app);
  const viewElement = resolveCameraViewElement(userId, sourceApp);
  const videoElement = resolveCameraVideoElement(userId, sourceApp, viewElement);
  return {
    app: sourceApp,
    viewElement,
    videoElement
  };
}

function videoTracks(videoElement) {
  const tracks = videoElement?.srcObject?.getVideoTracks?.();
  return Array.isArray(tracks) ? tracks : Array.from(tracks ?? []);
}

function canUserShareVideo(userId) {
  if (!userId) return true;
  const webRtc = globalThis.game?.webrtc;
  if (typeof webRtc?.canUserShareVideo !== "function") return true;
  try {
    return Boolean(webRtc.canUserShareVideo(userId));
  } catch {
    return true;
  }
}

function clientVideoDisabled() {
  return globalThis.game?.webrtc?.settings?.client?.disableVideo === true;
}

function usableVideoTrack(track) {
  if (!track || track.readyState === "ended") return false;
  if (track.enabled === false || track.muted === true) return false;
  return true;
}

export function isLiveCameraVideo(videoElement, userId) {
  if (!videoElement || videoElement.ended) return false;
  if (clientVideoDisabled()) return false;
  if (!canUserShareVideo(userId)) return false;
  if (!(Number(videoElement.videoWidth) > 0) || !(Number(videoElement.videoHeight) > 0)) return false;
  const tracks = videoTracks(videoElement);
  if (typeof videoElement.srcObject?.getVideoTracks === "function" && !tracks.some(usableVideoTrack)) return false;
  return true;
}

function listen(target, eventName, callback, removers) {
  if (typeof target?.addEventListener !== "function") return;
  target.addEventListener(eventName, callback);
  removers.push(() => target.removeEventListener?.(eventName, callback));
}

export function observeCameraVideo(videoElement, onChange) {
  if (!videoElement || typeof onChange !== "function") return () => {};
  const removers = [];
  const boundTracks = new Set();
  let active = true;
  const notify = () => {
    if (active) onChange();
  };
  const bindTrack = (track) => {
    if (!track || boundTracks.has(track)) return;
    boundTracks.add(track);
    TRACK_EVENTS.forEach((eventName) => listen(track, eventName, notify, removers));
  };
  VIDEO_EVENTS.forEach((eventName) => listen(videoElement, eventName, notify, removers));
  videoTracks(videoElement).forEach(bindTrack);
  const stream = videoElement.srcObject;
  listen(stream, "addtrack", (event) => {
    bindTrack(event?.track);
    notify();
  }, removers);
  listen(stream, "removetrack", notify, removers);
  return () => {
    if (!active) return;
    active = false;
    removers.splice(0).reverse().forEach((remove) => remove());
    boundTracks.clear();
  };
}
