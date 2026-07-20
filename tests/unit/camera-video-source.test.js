import test from "node:test";
import assert from "node:assert/strict";
import {
  isCameraViewsApp,
  isLiveCameraVideo,
  observeCameraVideo,
  resolveCameraVideoSource,
  resolveCameraViewsApp
} from "../../scripts/camera-video-source.js";

function eventTarget(properties = {}) {
  const listeners = new Map();
  return {
    ...properties,
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) ?? new Set();
      callbacks.add(callback);
      listeners.set(type, callbacks);
    },
    removeEventListener(type, callback) {
      listeners.get(type)?.delete(callback);
    },
    emit(type, event = {}) {
      Array.from(listeners.get(type) ?? []).forEach((callback) => callback(event));
    },
    listenerCount() {
      return Array.from(listeners.values()).reduce((total, callbacks) => total + callbacks.size, 0);
    }
  };
}

test("isCameraViewsApp recognizes CameraViews and its public lookup methods", () => {
  class CameraViews {
  }
  const methodApp = {
    getUserCameraView() {
    },
    getUserVideoElement() {
    }
  };

  assert.equal(isCameraViewsApp(new CameraViews()), true);
  assert.equal(isCameraViewsApp(methodApp), true);
  assert.equal(isCameraViewsApp({ getUserCameraView() {} }), false);
});

test("resolveCameraViewsApp prefers an explicit app and falls back to ui.webrtc", () => {
  const explicit = {
    getUserCameraView() {
    },
    getUserVideoElement() {
    }
  };
  const fallback = {
    getUserCameraView() {
    },
    getUserVideoElement() {
    }
  };
  globalThis.ui = { webrtc: fallback };

  assert.equal(resolveCameraViewsApp(explicit), explicit);
  assert.equal(resolveCameraViewsApp(null), fallback);

  delete globalThis.ui;
});

test("resolveCameraVideoSource uses application methods before DOM lookup", () => {
  const viewElement = { querySelector: () => null };
  const videoElement = { videoWidth: 640, videoHeight: 360 };
  const app = {
    getUserCameraView: (userId) => userId === "u1" ? viewElement : null,
    getUserVideoElement: (userId) => userId === "u1" ? videoElement : null
  };
  globalThis.document = {
    querySelectorAll() {
      throw new Error("DOM fallback should not run");
    }
  };

  const source = resolveCameraVideoSource("u1", app);

  assert.equal(source.app, app);
  assert.equal(source.viewElement, viewElement);
  assert.equal(source.videoElement, videoElement);

  delete globalThis.document;
});

test("resolveCameraVideoSource falls back to the matching camera view in the DOM", () => {
  const videoElement = { videoWidth: 640, videoHeight: 360 };
  const otherView = {
    dataset: { user: "other" },
    querySelector: () => null
  };
  const targetView = {
    dataset: { userId: "u1" },
    querySelector: (selector) => selector === "video" ? videoElement : null
  };
  globalThis.document = {
    querySelectorAll: () => [otherView, targetView]
  };

  const source = resolveCameraVideoSource("u1");

  assert.equal(source.app, null);
  assert.equal(source.viewElement, targetView);
  assert.equal(source.videoElement, videoElement);

  delete globalThis.document;
});

test("isLiveCameraVideo requires dimensions and a non-ended source", () => {
  assert.equal(isLiveCameraVideo(null), false);
  assert.equal(isLiveCameraVideo({ videoWidth: 0, videoHeight: 720, ended: false }), false);
  assert.equal(isLiveCameraVideo({ videoWidth: 1280, videoHeight: 720, ended: true }), false);
  assert.equal(isLiveCameraVideo({ videoWidth: 1280, videoHeight: 720, ended: false }), true);
});

test("isLiveCameraVideo rejects a stream whose video tracks all ended", () => {
  const videoElement = {
    videoWidth: 1280,
    videoHeight: 720,
    ended: false,
    srcObject: {
      getVideoTracks: () => [{ readyState: "ended" }, { readyState: "ended" }]
    }
  };

  assert.equal(isLiveCameraVideo(videoElement), false);

  videoElement.srcObject.getVideoTracks = () => [{ readyState: "live" }, { readyState: "ended" }];
  assert.equal(isLiveCameraVideo(videoElement), true);

  videoElement.srcObject.getVideoTracks = () => [];
  assert.equal(isLiveCameraVideo(videoElement), false);
});

test("isLiveCameraVideo rejects muted, disabled and non-sharing camera sources", () => {
  const track = { readyState: "live", enabled: false, muted: false };
  const videoElement = {
    videoWidth: 1280,
    videoHeight: 720,
    ended: false,
    hidden: true,
    srcObject: {
      getVideoTracks: () => [track]
    }
  };
  globalThis.game = {
    webrtc: {
      canUserShareVideo: () => true,
      settings: {
        client: {
          disableVideo: false
        }
      }
    }
  };

  assert.equal(isLiveCameraVideo(videoElement, "u1"), false);

  track.enabled = true;
  track.muted = true;
  assert.equal(isLiveCameraVideo(videoElement, "u1"), false);

  track.muted = false;
  assert.equal(isLiveCameraVideo(videoElement, "u1"), true);

  globalThis.game.webrtc.settings.client.disableVideo = true;
  assert.equal(isLiveCameraVideo(videoElement, "u1"), false);

  globalThis.game.webrtc.settings.client.disableVideo = false;
  globalThis.game.webrtc.canUserShareVideo = () => false;
  assert.equal(isLiveCameraVideo(videoElement, "u1"), false);

  delete globalThis.game;
});

test("observeCameraVideo watches video, stream and track events and cleans up", () => {
  const track = eventTarget({ readyState: "live" });
  const stream = eventTarget({
    getVideoTracks: () => [track]
  });
  const videoElement = eventTarget({ srcObject: stream });
  let changes = 0;

  const stop = observeCameraVideo(videoElement, () => {
    changes += 1;
  });
  videoElement.emit("playing");
  track.emit("mute");
  const nextTrack = eventTarget({ readyState: "live" });
  stream.emit("addtrack", { track: nextTrack });
  nextTrack.emit("ended");

  assert.equal(changes, 4);
  assert.ok(videoElement.listenerCount() > 0);
  assert.ok(track.listenerCount() > 0);
  assert.ok(nextTrack.listenerCount() > 0);

  stop();
  stop();
  videoElement.emit("ended");
  track.emit("ended");
  nextTrack.emit("ended");

  assert.equal(changes, 4);
  assert.equal(videoElement.listenerCount(), 0);
  assert.equal(track.listenerCount(), 0);
  assert.equal(nextTrack.listenerCount(), 0);
  assert.equal(stream.listenerCount(), 0);
});
