import test from "node:test";
import assert from "node:assert/strict";
import {
  applySceneBackgroundNow,
  cleanupSceneBackground,
  dumpSceneBackgroundSnapshot,
  getSceneBackgroundStatus,
  initializeSceneBackgroundRenderer
} from "../../scripts/scene-background-renderer.js";

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

function point() {
  return {
    x: 0,
    y: 0,
    set(x, y = x) {
      this.x = x;
      this.y = y;
    }
  };
}

function createPixi(ticker) {
  class BaseImageResource {
    constructor(source) {
      this.source = source;
      this.width = source.videoWidth;
      this.height = source.videoHeight;
      this.updateCount = 0;
      this.destroyed = false;
    }

    update() {
      this.width = this.source.videoWidth;
      this.height = this.source.videoHeight;
      this.updateCount += 1;
    }

    resize(width, height) {
      this.width = width;
      this.height = height;
    }

    destroy() {
      this.source = null;
      this.destroyed = true;
    }
  }

  class BaseTexture {
    constructor(resource) {
      this.resource = resource;
      this.destroyed = false;
    }

    get width() {
      return this.resource.width;
    }

    get height() {
      return this.resource.height;
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      if (this.resource?.internal) this.resource.destroy();
    }
  }

  class Texture {
    constructor(baseTexture) {
      this.baseTexture = baseTexture;
      this.destroyed = false;
    }

    get width() {
      return this.baseTexture.width;
    }

    get height() {
      return this.baseTexture.height;
    }

    destroy(destroyBase) {
      if (this.destroyed) return;
      this.destroyed = true;
      if (destroyBase) this.baseTexture.destroy();
    }
  }

  return {
    BaseImageResource,
    BaseTexture,
    Texture,
    SCALE_MODES: { LINEAR: 1 },
    Ticker: { shared: ticker }
  };
}

function createMeshClass() {
  return class PrimarySpriteMesh {
    constructor({ name, texture, object }) {
      this.name = name;
      this.texture = texture;
      this.object = object;
      this.anchor = point();
      this.position = point();
      this.destroyed = false;
    }

    resize(width, height, { fit }) {
      const xRatio = width / this.texture.width;
      const yRatio = height / this.texture.height;
      if (fit === "fill") {
        this.width = width;
        this.height = height;
        return;
      }
      const ratio = fit === "cover" ? Math.max(xRatio, yRatio) : Math.min(xRatio, yRatio);
      this.width = this.texture.width * ratio;
      this.height = this.texture.height * ratio;
    }

    destroy() {
      this.destroyed = true;
    }
  };
}

function createTicker() {
  const callbacks = new Set();
  return {
    callbacks,
    add(callback) {
      callbacks.add(callback);
    },
    remove(callback) {
      callbacks.delete(callback);
    },
    tick() {
      Array.from(callbacks).forEach((callback) => callback());
    }
  };
}

function createVideo(width = 1280, height = 720) {
  const track = eventTarget({
    readyState: "live",
    stopCalls: 0,
    stop() {
      this.stopCalls += 1;
    }
  });
  const stream = eventTarget({
    getVideoTracks: () => [track]
  });
  return eventTarget({
    videoWidth: width,
    videoHeight: height,
    ended: false,
    srcObject: stream,
    track,
    playCalls: 0,
    pauseCalls: 0,
    loadCalls: 0,
    play() {
      this.playCalls += 1;
    },
    pause() {
      this.pauseCalls += 1;
    },
    load() {
      this.loadCalls += 1;
    }
  });
}

function createEnvironment() {
  const ticker = createTicker();
  const mask = {};
  const background = {
    elevation: 0,
    sortLayer: 0,
    sort: 0,
    zIndex: -Infinity,
    restrictsLight: true,
    restrictsWeather: true,
    occlusionMode: 3
  };
  const primary = {
    background,
    children: [],
    videoMeshes: new Set(),
    sortDirty: false,
    addChild(mesh) {
      mesh.parent = this;
      this.children.push(mesh);
      return mesh;
    },
    addChildAt(mesh, index) {
      mesh.parent = this;
      this.children.splice(index, 0, mesh);
      return mesh;
    },
    removeChild(mesh) {
      this.children = this.children.filter((child) => child !== mesh);
      mesh.parent = null;
    }
  };
  const hookHandlers = new Map();
  const hookCalls = [];
  let clock = 0;
  globalThis.PIXI = createPixi(ticker);
  globalThis.canvas = {
    ready: true,
    scene: { id: "scene-1" },
    dimensions: {
      sceneRect: { x: 100, y: 200, width: 1000, height: 500 }
    },
    masks: { scene: mask },
    primary,
    app: { ticker }
  };
  globalThis.foundry = {
    canvas: {
      primary: { PrimarySpriteMesh: createMeshClass() },
      groups: { PrimaryCanvasGroup: { SORT_LAYERS: { SCENE: 0, TILES: 500 } } }
    }
  };
  globalThis.game = {
    users: new Map([
      ["u1", { id: "u1", active: true }],
      ["u2", { id: "u2", active: false }]
    ])
  };
  globalThis.Hooks = {
    on(name, callback) {
      const callbacks = hookHandlers.get(name) ?? [];
      callbacks.push(callback);
      hookHandlers.set(name, callbacks);
    },
    callAll(name, payload) {
      hookCalls.push({ name, payload });
    }
  };
  return {
    hookCalls,
    hookHandlers,
    mask,
    primary,
    ticker,
    advance(ms) {
      clock += ms;
    },
    now() {
      return clock;
    }
  };
}

const environment = createEnvironment();
let configuration = null;
let currentVideo = null;
const app = {
  getUserCameraView: () => ({ querySelector: () => currentVideo }),
  getUserVideoElement: () => currentVideo
};

initializeSceneBackgroundRenderer({
  getConfiguration: () => configuration,
  now: () => environment.now()
});

test("initialize registers the renderer lifecycle hooks once", () => {
  initializeSceneBackgroundRenderer({
    getConfiguration: () => configuration,
    now: () => environment.now()
  });

  assert.deepEqual(
    Array.from(environment.hookHandlers.keys()).sort(),
    ["canvasReady", "canvasTearDown", "renderApplicationV2", "rtcSettingsChanged", "userConnected"].sort()
  );
  environment.hookHandlers.forEach((handlers) => assert.equal(handlers.length, 1));
});

test("disabled configuration keeps the native background and reports disabled", () => {
  configuration = null;

  const result = applySceneBackgroundNow(app);

  assert.equal(result.state, "disabled");
  assert.equal(result.sceneId, "scene-1");
  assert.equal(result.fit, "cover");
  assert.equal(environment.primary.children.length, 0);
});

test("a missing configured user reports unavailable", () => {
  configuration = { playerId: "missing", fit: "contain" };

  const result = applySceneBackgroundNow(app);

  assert.deepEqual(result, {
    state: "unavailable",
    sceneId: "scene-1",
    playerId: "missing",
    fit: "contain",
    reason: "missing-user"
  });
  assert.equal(environment.primary.children.length, 0);
});

test("a valid user without usable video reports waiting", () => {
  const statusCallsBefore = environment.hookCalls.length;
  configuration = { playerId: "u1", fit: "cover" };
  currentVideo = null;

  assert.equal(applySceneBackgroundNow(app).reason, "video-unavailable");

  currentVideo = createVideo(0, 0);
  assert.equal(applySceneBackgroundNow(app).reason, "video-not-live");
  assert.equal(environment.primary.children.length, 0);
  assert.equal(dumpSceneBackgroundSnapshot().hasPendingVideo, true);

  currentVideo.videoWidth = 1280;
  currentVideo.videoHeight = 720;
  currentVideo.emit("loadedmetadata");
  assert.equal(applySceneBackgroundNow(app).state, "active");
  assert.equal(dumpSceneBackgroundSnapshot().hasPendingVideo, false);
  assert.deepEqual(
    environment.hookCalls
      .slice(statusCallsBefore)
      .filter(({ name }) => name === "charlemos-camera-layout.sceneBackgroundStatusChanged")
      .map(({ payload }) => payload.state),
    ["waiting", "waiting", "active"]
  );
  cleanupSceneBackground();
});

test("active video creates one masked PrimarySpriteMesh between background and tiles", () => {
  configuration = { playerId: "u1", fit: "cover" };
  currentVideo = createVideo();

  const result = applySceneBackgroundNow(app);
  const mesh = environment.primary.children[0];

  assert.equal(result.state, "active");
  assert.equal(result.videoWidth, 1280);
  assert.equal(result.videoHeight, 720);
  assert.equal(environment.primary.children.length, 1);
  assert.equal(mesh.name, "charlemos-camera-layout.scene-background");
  assert.equal(mesh.position.x, 600);
  assert.equal(mesh.position.y, 450);
  assert.equal(mesh.anchor.x, 0.5);
  assert.equal(mesh.anchor.y, 0.5);
  assert.equal(mesh.width, 1000);
  assert.equal(mesh.height, 562.5);
  assert.equal(mesh.mask, environment.mask);
  assert.equal(mesh.sortLayer, 0);
  assert.equal(mesh.zIndex, environment.primary.background.zIndex);
  assert.ok(mesh.sortLayer < 500);
  assert.equal(mesh.restrictsLight, true);
  assert.equal(mesh.restrictsWeather, true);
  assert.equal(mesh.occlusionMode, 3);
  assert.equal(environment.primary.videoMeshes.size, 0);
  assert.equal(currentVideo.playCalls, 0);
  assert.equal(currentVideo.pauseCalls, 0);
  assert.equal(currentVideo.loadCalls, 0);
  assert.equal(currentVideo.track.stopCalls, 0);

  const statusCalls = environment.hookCalls.length;
  const resourceUpdates = mesh.texture.baseTexture.resource.updateCount;
  applySceneBackgroundNow(app);
  assert.equal(environment.hookCalls.length, statusCalls);
  assert.equal(mesh.texture.baseTexture.resource.updateCount, resourceUpdates);
});

test("same-level scene textures keep the live mesh directly above background and below foreground", () => {
  cleanupSceneBackground();
  const background = environment.primary.background;
  const foreground = {
    elevation: background.elevation,
    sortLayer: background.sortLayer,
    sort: background.sort,
    zIndex: background.zIndex
  };
  background.parent = environment.primary;
  foreground.parent = environment.primary;
  environment.primary.children = [background, foreground];
  configuration = { playerId: "u1", fit: "cover" };
  currentVideo = createVideo();

  applySceneBackgroundNow(app);

  const mesh = environment.primary.children[1];
  assert.equal(environment.primary.children[0], background);
  assert.equal(environment.primary.children[2], foreground);
  assert.equal(mesh.name, "charlemos-camera-layout.scene-background");
  assert.equal(mesh.elevation, background.elevation);
  assert.equal(mesh.sortLayer, background.sortLayer);
  assert.equal(mesh.sort, background.sort);
  assert.equal(mesh.zIndex, background.zIndex);

  cleanupSceneBackground();
  environment.primary.children = [];
  background.parent = null;
  foreground.parent = null;
  currentVideo = createVideo();
  applySceneBackgroundNow(app);
});

test("reconcile reuses the mesh and applies contain and fill geometry", () => {
  const originalMesh = environment.primary.children[0];
  configuration = { playerId: "u1", fit: "contain" };

  applySceneBackgroundNow(app);

  assert.equal(environment.primary.children.length, 1);
  assert.equal(environment.primary.children[0], originalMesh);
  assert.ok(Math.abs(originalMesh.width - 888.8888888888889) < 0.000001);
  assert.equal(originalMesh.height, 500);
  assert.equal(getSceneBackgroundStatus().fit, "contain");

  currentVideo.videoWidth = 1000;
  currentVideo.videoHeight = 1000;
  currentVideo.emit("resize");
  applySceneBackgroundNow(app);

  assert.equal(environment.primary.children[0], originalMesh);
  assert.equal(originalMesh.width, 500);
  assert.equal(originalMesh.height, 500);

  configuration = { playerId: "u1", fit: "fill" };
  applySceneBackgroundNow(app);

  assert.equal(environment.primary.children[0], originalMesh);
  assert.equal(originalMesh.width, 1000);
  assert.equal(originalMesh.height, 500);
});

test("manual resource updates are capped at thirty frames per second", () => {
  const updatesBefore = dumpSceneBackgroundSnapshot().frameUpdateCount;

  environment.ticker.tick();
  environment.advance(10);
  environment.ticker.tick();
  environment.advance(24);
  environment.ticker.tick();

  const snapshot = dumpSceneBackgroundSnapshot();
  assert.equal(snapshot.frameUpdateCount - updatesBefore, 2);
  assert.equal(environment.ticker.callbacks.size, 1);
});

test("replacing the video destroys old PIXI resources and removes observers", () => {
  const previousVideo = currentVideo;
  const previousMesh = environment.primary.children[0];
  const previousTexture = previousMesh.texture;
  assert.ok(previousVideo.listenerCount() > 0);
  currentVideo = createVideo(1920, 1080);

  applySceneBackgroundNow(app);

  assert.equal(previousMesh.destroyed, true);
  assert.equal(previousTexture.destroyed, true);
  assert.equal(previousTexture.baseTexture.destroyed, true);
  assert.equal(previousTexture.baseTexture.resource.destroyed, true);
  assert.equal(previousVideo.listenerCount(), 0);
  assert.equal(environment.primary.children.length, 1);
  assert.notEqual(environment.primary.children[0], previousMesh);
  assert.equal(environment.ticker.callbacks.size, 1);
  assert.equal(previousVideo.pauseCalls, 0);
  assert.equal(previousVideo.loadCalls, 0);
  assert.equal(previousVideo.track.stopCalls, 0);
});

test("video and track loss removes the runtime while preserving configuration", () => {
  currentVideo.track.muted = true;
  currentVideo.track.emit("mute");
  assert.equal(applySceneBackgroundNow(app).reason, "video-not-live");
  assert.equal(environment.primary.children.length, 0);

  currentVideo.track.muted = false;
  currentVideo.track.emit("unmute");
  assert.equal(applySceneBackgroundNow(app).state, "active");
  assert.equal(environment.primary.children.length, 1);

  const removedTrack = currentVideo.track;
  currentVideo.srcObject.getVideoTracks = () => [];
  currentVideo.srcObject.emit("removetrack", { track: removedTrack });
  assert.equal(applySceneBackgroundNow(app).reason, "video-not-live");
  assert.equal(environment.primary.children.length, 0);

  currentVideo = createVideo();
  assert.equal(applySceneBackgroundNow(app).state, "active");
  currentVideo.ended = true;
  currentVideo.emit("ended");

  const result = applySceneBackgroundNow(app);

  assert.equal(result.state, "waiting");
  assert.equal(result.reason, "video-not-live");
  assert.equal(result.playerId, "u1");
  assert.equal(environment.primary.children.length, 0);
  assert.equal(environment.ticker.callbacks.size, 0);
  assert.equal(currentVideo.pauseCalls, 0);
  assert.equal(currentVideo.loadCalls, 0);
  assert.equal(currentVideo.track.stopCalls, 0);

  currentVideo = createVideo();
  applySceneBackgroundNow(app);
  currentVideo.track.readyState = "ended";
  currentVideo.track.emit("ended");
  assert.equal(applySceneBackgroundNow(app).reason, "video-not-live");
  assert.equal(environment.primary.children.length, 0);
});

test("canvas teardown is safe and leaves configured state waiting", () => {
  currentVideo = createVideo();
  configuration = { playerId: "u1", fit: "cover" };
  applySceneBackgroundNow(app);
  const mesh = environment.primary.children[0];

  environment.hookHandlers.get("canvasTearDown")[0]();
  environment.hookHandlers.get("canvasTearDown")[0]();

  assert.equal(mesh.destroyed, true);
  assert.equal(environment.primary.children.length, 0);
  assert.equal(environment.ticker.callbacks.size, 0);
  assert.equal(getSceneBackgroundStatus().state, "waiting");
  assert.equal(getSceneBackgroundStatus().reason, "canvas-unavailable");
  assert.equal(currentVideo.pauseCalls, 0);
  assert.equal(currentVideo.loadCalls, 0);
  assert.equal(currentVideo.track.stopCalls, 0);
});

test("cleanup is idempotent and reports an empty runtime snapshot", () => {
  cleanupSceneBackground();
  cleanupSceneBackground();

  const snapshot = dumpSceneBackgroundSnapshot();
  assert.equal(snapshot.state, "disabled");
  assert.equal(snapshot.hasMesh, false);
  assert.equal(snapshot.hasVideo, false);
  assert.equal(snapshot.hasTicker, false);
  assert.equal(environment.ticker.callbacks.size, 0);
});
