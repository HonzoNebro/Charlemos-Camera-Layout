const CAMERA_VIEW_SELECTOR = ".camera-view[data-user], .camera-view[data-user-id]";
const VIDEO_EVENTS = ["loadedmetadata", "playing", "resize", "emptied", "ended", "stalled", "abort", "loadstart"];
const TRACK_EVENTS = ["ended", "mute", "unmute"];

export function isCameraViewsApp(app) {
  if (!app) return false;
  if (app.constructor?.name === "CameraViews") return true;
  return typeof app.getUserCameraView === "function" && typeof app.getUserVideoElement === "function";
}

export function resolveCameraViewsApp(app) {
  if (isCameraViewsApp(app)) return app;
  if (isCameraViewsApp(globalThis.ui?.webrtc)) return globalThis.ui.webrtc;
  return null;
}

function findCameraViewInDocument(userId) {
  const views = globalThis.document?.querySelectorAll?.(CAMERA_VIEW_SELECTOR) ?? [];
  return Array.from(views).find((view) => String(view?.dataset?.user ?? view?.dataset?.userId ?? "") === String(userId)) ?? null;
}

export function resolveCameraViewElement(userId, app) {
  const cameraViews = resolveCameraViewsApp(app);
  try {
    const view = cameraViews?.getUserCameraView?.(userId);
    if (view) return view;
  } catch {
  }
  return findCameraViewInDocument(userId);
}

export function resolveCameraVideoElement(userId, app, viewElement) {
  const cameraViews = resolveCameraViewsApp(app);
  try {
    const video = cameraViews?.getUserVideoElement?.(userId);
    if (video) return video;
  } catch {
  }
  const view = viewElement ?? resolveCameraViewElement(userId, cameraViews);
  return view?.querySelector?.("video") ?? null;
}

export function resolveCameraVideoSource(userId, app) {
  const cameraViews = resolveCameraViewsApp(app);
  const viewElement = resolveCameraViewElement(userId, cameraViews);
  const videoElement = resolveCameraVideoElement(userId, cameraViews, viewElement);
  return {
    app: cameraViews,
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
