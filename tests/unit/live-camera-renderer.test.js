import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCameraLayoutsNow,
  applyGeometryDefaults,
  applyFrameOverlayFallbackStyle,
  bindReactiveAvatarVisibility,
  unbindReactiveAvatarVisibility,
  dumpRendererDebugSnapshot,
  isFrameOverlayPath,
  isRendererDebugEnabled,
  prepareModuleGeometryForLayouts,
  requestCameraLayoutsApply,
  requestRenderedCameraLayoutsApply,
  resolveRelativeLayout,
  resolveRelativeLayoutFromMetrics,
  resolveSceneLayouts,
  shouldBlockNativeGeometryInteraction,
  syncOverlayMediaSource,
  syncResizeHandleVisibility,
  syncGeometryInteractionMode,
  syncExpandedVideoViewport,
  syncManagedViewGeometry,
  syncTransparentFrameClipPath,
  syncTransparentFrameMode,
  syncFoundryAvatarVisibility,
  transformAwareClipPath,
  viewSupportsModuleGeometry,
  videoStyle
} from "../../scripts/live-camera-renderer.js";

function viewWith(nodes) {
  return {
    querySelectorAll: () => nodes
  };
}

function classTokens(element) {
  return String(element.className ?? "").split(/\s+/).filter(Boolean);
}

function matchesTestSelector(element, selector) {
  const text = selector.trim();
  const tag = text.match(/^[a-z]+/i)?.[0];
  if (tag && element.tagName !== tag.toUpperCase()) return false;
  const classes = [...text.matchAll(/\.([\w-]+)/g)].map((match) => match[1]);
  if (classes.some((name) => !element.classList.contains(name))) return false;
  const dataMatch = text.match(/\[data-([\w-]+)=['"]([^'"]+)['"]\]/);
  if (dataMatch) {
    const key = dataMatch[1].replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    if (element.dataset[key] !== dataMatch[2]) return false;
  }
  if (text.includes("[class*='") || text.includes('[class*="')) {
    const fragment = text.match(/\[class\*=['"]([^'"]+)['"]\]/)?.[1] ?? "";
    if (!String(element.className).includes(fragment)) return false;
  }
  if (text.includes("[") && !dataMatch && !text.includes("[class*=")) return false;
  return Boolean(tag || classes.length || dataMatch);
}

class TestElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.className = "";
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.isConnected = true;
    this.rect = { top: 0, right: 320, bottom: 240, left: 0, width: 320, height: 240 };
    this.classList = {
      add: (...names) => {
        this.className = [...new Set([...classTokens(this), ...names])].join(" ");
      },
      contains: (name) => classTokens(this).includes(name),
      remove: (...names) => {
        this.className = classTokens(this).filter((name) => !names.includes(name)).join(" ");
      },
      toggle: (name, force) => {
        const active = force === undefined ? !this.classList.contains(name) : Boolean(force);
        if (active) this.classList.add(name);
        else this.classList.remove(name);
        return active;
      }
    };
  }

  appendChild(child) {
    child.parentElement = this;
    child.isConnected = this.isConnected;
    this.children.push(child);
    return child;
  }

  insertBefore(child, before) {
    const index = this.children.indexOf(before);
    if (index < 0) return this.appendChild(child);
    child.parentElement = this;
    child.isConnected = this.isConnected;
    this.children.splice(index, 0, child);
    return child;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    }
    this.parentElement = null;
    this.isConnected = false;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",");
    const descendants = [];
    const visit = (element) => {
      element.children.forEach((child) => {
        descendants.push(child);
        visit(child);
      });
    };
    visit(this);
    return descendants.filter((element) => selectors.some((part) => matchesTestSelector(element, part)));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    if (name === "src") return this.src ?? null;
    if (name === "style") return "";
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "src") this.src = "";
  }

  addEventListener() {}

  closest() {
    return null;
  }

  contains(target) {
    return this === target || this.children.some((child) => child.contains(target));
  }

  getBoundingClientRect() {
    return this.rect;
  }
}

function testDocument() {
  const frames = [];
  const ownerDocument = {
    created: [],
    defaultView: {
      getComputedStyle: () => ({ marginTop: "0px", marginRight: "0px", marginBottom: "0px", marginLeft: "0px" }),
      requestAnimationFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      }
    },
    createElement: (tagName) => {
      const element = new TestElement(tagName, ownerDocument);
      ownerDocument.created.push(element);
      return element;
    },
    querySelectorAll: () => []
  };
  ownerDocument.flushFrames = () => frames.splice(0).forEach((callback) => callback());
  return ownerDocument;
}

function cameraViewFixture(ownerDocument) {
  const view = ownerDocument.createElement("section");
  view.className = "camera-view";
  const viewport = ownerDocument.createElement("div");
  viewport.className = "video-container";
  viewport.style.overflow = "auto";
  viewport.style.borderRadius = "3px";
  viewport.style.clipPath = "circle(50%)";
  const avatar = ownerDocument.createElement("img");
  avatar.className = "user-avatar";
  viewport.appendChild(avatar);
  view.appendChild(viewport);
  return { avatar, view, viewport };
}

test("syncFoundryAvatarVisibility hides avatar images when video feed is live", () => {
  const avatarA = { tagName: "IMG", style: { display: "" } };
  const avatarB = { tagName: "IMG", style: { display: "block" } };
  const videoElement = {
    videoWidth: 1280,
    videoHeight: 720,
    ended: false
  };

  syncFoundryAvatarVisibility(viewWith([avatarA, avatarB]), videoElement);

  assert.equal(avatarA.style.display, "");
  assert.equal(avatarB.style.display, "");
  assert.equal(avatarA.style.visibility, "hidden");
  assert.equal(avatarB.style.visibility, "hidden");
  assert.equal(avatarA.style.opacity, "0");
  assert.equal(avatarB.style.opacity, "0");
});

test("syncFoundryAvatarVisibility keeps avatar visible when no live feed exists", () => {
  const avatar = { tagName: "IMG", style: { display: "none" } };
  const videoElement = {
    videoWidth: 0,
    videoHeight: 0,
    ended: false
  };

  syncFoundryAvatarVisibility(viewWith([avatar]), videoElement);

  assert.equal(avatar.style.display, "none");
});

test("syncFoundryAvatarVisibility does not hide avatar on readyState without real video dimensions", () => {
  const avatar = { tagName: "IMG", style: { display: "" } };
  const videoElement = {
    readyState: 4,
    paused: false,
    ended: false,
    videoWidth: 0,
    videoHeight: 0
  };

  syncFoundryAvatarVisibility(viewWith([avatar]), videoElement);

  assert.equal(avatar.style.display, "");
});

test("syncFoundryAvatarVisibility forceShow restores avatar", () => {
  const avatar = {
    tagName: "IMG",
    style: { display: "none", visibility: "hidden", opacity: "0", pointerEvents: "none" },
    dataset: { charlemosHidden: "1" }
  };
  const videoElement = {
    videoWidth: 1280,
    videoHeight: 720,
    ended: false
  };

  syncFoundryAvatarVisibility(viewWith([avatar]), videoElement, true);

  assert.equal(avatar.style.display, "");
  assert.equal(avatar.style.visibility, "");
  assert.equal(avatar.style.opacity, "");
  assert.equal(avatar.style.pointerEvents, "");
  assert.equal(avatar.dataset.charlemosHidden, undefined);
});

test("videoStyle enforces visible video element", () => {
  const style = videoStyle({
    filter: "grayscale(0.2)",
    geometry: { borderRadius: "8px", skewX: 0, skewY: 0 }
  });

  assert.equal(style.display, "block");
  assert.equal(style.visibility, "visible");
  assert.equal(style.opacity, "1");
  assert.equal(style.width, "100%");
  assert.equal(style.height, "100%");
  assert.equal(style.objectFit, "cover");
  assert.equal(style.backgroundColor, "transparent");
  assert.equal(videoStyle({ transform: "translateX(12px)" }, "matrix(-1, 0, 0, 1, 0, 0)").transform, "translateX(12px) matrix(-1, 0, 0, 1, 0, 0)");
});

test("syncFoundryAvatarVisibility hides fallback wrapper without video", () => {
  const fallback = {
    tagName: "DIV",
    className: "user-avatar",
    style: { display: "" },
    querySelector: () => null
  };
  const videoElement = {
    videoWidth: 640,
    videoHeight: 360,
    ended: false
  };

  syncFoundryAvatarVisibility(viewWith([fallback]), videoElement);

  assert.equal(fallback.style.display, "");
  assert.equal(fallback.style.visibility, "hidden");
  assert.equal(fallback.style.opacity, "0");
});

test("syncFoundryAvatarVisibility restores marked avatar when stream stops", () => {
  const avatar = {
    tagName: "IMG",
    style: { display: "", visibility: "hidden", opacity: "0", pointerEvents: "none" },
    dataset: { charlemosHidden: "1" }
  };
  const videoElement = {
    videoWidth: 0,
    videoHeight: 0,
    ended: false
  };

  syncFoundryAvatarVisibility(viewWith([avatar]), videoElement);

  assert.equal(avatar.style.visibility, "");
  assert.equal(avatar.style.opacity, "");
  assert.equal(avatar.style.pointerEvents, "");
  assert.equal(avatar.dataset.charlemosHidden, undefined);
});

test("bindReactiveAvatarVisibility hides avatar when video metadata arrives", () => {
  let listener = null;
  const avatar = {
    tagName: "IMG",
    style: { display: "" },
    dataset: {}
  };
  const videoElement = {
    videoWidth: 0,
    videoHeight: 0,
    ended: false,
    addEventListener: (type, handler) => {
      if (type === "loadedmetadata") listener = handler;
    }
  };

  bindReactiveAvatarVisibility(viewWith([avatar]), videoElement);
  videoElement.videoWidth = 640;
  videoElement.videoHeight = 360;
  listener();

  assert.equal(avatar.style.visibility, "hidden");
  assert.equal(avatar.style.opacity, "0");
  assert.equal(avatar.dataset.charlemosHidden, "1");
});

test("reactive avatar listeners detach on video replacement and view cleanup", () => {
  const listeners = () => {
    const active = new Map();
    return { active, addEventListener: (type, handler) => active.set(type, handler), removeEventListener: (type, handler) => { if (active.get(type) === handler) active.delete(type); } };
  };
  const first = listeners();
  const second = listeners();
  const view = viewWith([]);
  bindReactiveAvatarVisibility(view, first);
  assert.equal(first.active.size, 3);
  bindReactiveAvatarVisibility(view, second);
  assert.equal(first.active.size, 0);
  assert.equal(second.active.size, 3);
  unbindReactiveAvatarVisibility(view);
  assert.equal(second.active.size, 0);
  assert.equal(second.__charlemosAvatarVisibilityBound, undefined);
});

test("bindReactiveAvatarVisibility does not duplicate video listeners", () => {
  let listenerCount = 0;
  const videoElement = {
    addEventListener: () => {
      listenerCount += 1;
    }
  };
  const viewElement = viewWith([]);

  bindReactiveAvatarVisibility(viewElement, videoElement);
  bindReactiveAvatarVisibility(viewElement, videoElement);

  assert.equal(listenerCount, 3);
});

test("bindReactiveAvatarVisibility restores marked avatar when reactive feed stops", () => {
  let listener = null;
  const avatar = {
    tagName: "IMG",
    style: { display: "", visibility: "hidden", opacity: "0", pointerEvents: "none" },
    dataset: { charlemosHidden: "1" }
  };
  const videoElement = {
    videoWidth: 640,
    videoHeight: 360,
    ended: false,
    addEventListener: (type, handler) => {
      if (type === "playing") listener = handler;
    }
  };

  bindReactiveAvatarVisibility(viewWith([avatar]), videoElement);
  videoElement.videoWidth = 0;
  videoElement.videoHeight = 0;
  listener();

  assert.equal(avatar.style.visibility, "");
  assert.equal(avatar.style.opacity, "");
  assert.equal(avatar.style.pointerEvents, "");
  assert.equal(avatar.dataset.charlemosHidden, undefined);
});

test("isFrameOverlayPath detects frame asset paths", () => {
  assert.equal(isFrameOverlayPath("modules/falemos/assets/img/frames/elegant.png"), true);
  assert.equal(isFrameOverlayPath("assets/overlays/particles.svg"), false);
});

test("applyFrameOverlayFallbackStyle enforces frame-safe background sizing", () => {
  const element = {
    style: {
      backgroundSize: "",
      backgroundPosition: "",
      backgroundRepeat: "",
      mixBlendMode: ""
    }
  };

  applyFrameOverlayFallbackStyle(element, "modules/falemos/assets/img/frames/elegant.png");

  assert.equal(element.style.backgroundSize, "100% 100%");
  assert.equal(element.style.backgroundPosition, "center");
  assert.equal(element.style.backgroundRepeat, "no-repeat");
  assert.equal(element.style.mixBlendMode, "screen");
});

test("applyFrameOverlayFallbackStyle respects explicit fit mode and anchor", () => {
  const element = {
    style: {
      backgroundSize: "contain",
      backgroundPosition: "right bottom",
      backgroundRepeat: "no-repeat",
      mixBlendMode: ""
    }
  };

  applyFrameOverlayFallbackStyle(element, {
    imageUrl: "modules/falemos/assets/img/frames/elegant.png",
    fitMode: "contain",
    anchor: "bottom-right"
  });

  assert.equal(element.style.backgroundSize, "contain");
  assert.equal(element.style.backgroundPosition, "right bottom");
  assert.equal(element.style.backgroundRepeat, "no-repeat");
});

test("applyFrameOverlayFallbackStyle can target media elements", () => {
  const element = {
    style: {
      objectFit: "",
      objectPosition: "",
      mixBlendMode: ""
    }
  };

  applyFrameOverlayFallbackStyle(element, "modules/falemos/assets/img/frames/elegant.webm");

  assert.equal(element.style.objectFit, "fill");
  assert.equal(element.style.objectPosition, "center");
  assert.equal(element.style.mixBlendMode, "screen");
});

test("syncOverlayMediaSource does not reset identical video source", () => {
  let srcWrites = 0;
  const mediaElement = {
    dataset: { charlemosOverlaySource: "modules/jb2a_patreon/Library/1st_Level/Sleep/SleepSymbol01_01_Dark_OrangePurple_400x400.webm" },
    getAttribute: (name) => (name === "src" ? "modules/jb2a_patreon/Library/1st_Level/Sleep/SleepSymbol01_01_Dark_OrangePurple_400x400.webm" : null),
    play: () => Promise.resolve(),
    pause: () => {},
    removeAttribute: () => {},
    load: () => {}
  };
  Object.defineProperty(mediaElement, "src", {
    get() {
      return this.dataset.charlemosOverlaySource;
    },
    set(value) {
      srcWrites += 1;
      this.dataset.charlemosOverlaySource = value;
    }
  });

  syncOverlayMediaSource(mediaElement, "video", "modules/jb2a_patreon/Library/1st_Level/Sleep/SleepSymbol01_01_Dark_OrangePurple_400x400.webm");

  assert.equal(srcWrites, 0);
});

test("requestCameraLayoutsApply keeps deferred renderer scheduling", () => {
  const delays = [];
  globalThis.window = {
    setTimeout: (_fn, delay) => {
      delays.push(delay);
      return 1;
    },
    clearTimeout: () => {}
  };

  requestCameraLayoutsApply();

  assert.equal(delays.at(-1), 50);
});

test("requestRenderedCameraLayoutsApply schedules immediate renderer reapply", () => {
  const delays = [];
  globalThis.window = {
    setTimeout: (_fn, delay) => {
      delays.push(delay);
      return 1;
    },
    clearTimeout: () => {}
  };

  requestRenderedCameraLayoutsApply();

  assert.equal(delays.at(-1), 0);
});

test("popout rescheduling clears the timer from its original detached window", () => {
  const cleared = [];
  const firstWindow = {
    setTimeout: () => 11,
    clearTimeout: (timerId) => cleared.push(["first", timerId])
  };
  const secondWindow = {
    setTimeout: () => 22,
    clearTimeout: (timerId) => cleared.push(["second", timerId])
  };
  class CameraPopout {
    constructor() {
      this.user = { id: "u1" };
      this.element = { ownerDocument: { defaultView: firstWindow } };
    }
  }
  const app = new CameraPopout();

  requestRenderedCameraLayoutsApply(app);
  app.element = { ownerDocument: { defaultView: secondWindow } };
  requestRenderedCameraLayoutsApply(app);

  assert.deepEqual(cleared, [["first", 11]]);
});

test("isRendererDebugEnabled reads module setting", () => {
  globalThis.game = {
    settings: {
      get: () => true
    }
  };
  assert.equal(isRendererDebugEnabled(), true);
});

test("dumpRendererDebugSnapshot returns null when no camera app exists", () => {
  globalThis.ui = { webrtc: null };
  const snapshot = dumpRendererDebugSnapshot("u1");
  assert.equal(snapshot, null);
});

test("syncManagedViewGeometry only clears geometry previously managed by module", () => {
  const nativeView = {
    style: {
      position: "absolute",
      top: "10px",
      left: "20px",
      width: "320px",
      height: "180px"
    },
    dataset: {}
  };

  syncManagedViewGeometry(nativeView, {}, false);

  assert.equal(nativeView.style.position, "absolute");
  assert.equal(nativeView.style.top, "10px");
  assert.equal(nativeView.style.left, "20px");
  assert.equal(nativeView.style.width, "320px");
  assert.equal(nativeView.style.height, "180px");

  const moduleView = {
    style: {
      position: "fixed",
      top: "100px",
      left: "200px",
      width: "849px",
      height: "636px"
    },
    dataset: {}
  };

  syncManagedViewGeometry(moduleView, { position: "absolute", top: "8px", left: "12px", width: "300px", height: "160px" }, true);
  assert.equal(moduleView.dataset.charlemosGeometryManaged, "1");
  assert.equal(moduleView.dataset.charlemosNativeWidth, "849px");
  assert.equal(moduleView.style.top, "8px");

  syncManagedViewGeometry(moduleView, {}, false);
  assert.equal(moduleView.dataset.charlemosGeometryManaged, undefined);
  assert.equal(moduleView.style.position, "fixed");
  assert.equal(moduleView.style.top, "100px");
  assert.equal(moduleView.style.left, "200px");
  assert.equal(moduleView.style.width, "849px");
  assert.equal(moduleView.style.height, "636px");
});

test("syncGeometryInteractionMode toggles module ownership classes", () => {
  const classes = new Set();
  const viewElement = {
    classList: {
      toggle: (name, active) => {
        if (active) classes.add(name);
        else classes.delete(name);
      }
    }
  };

  syncGeometryInteractionMode(viewElement, true);
  assert.equal(classes.has("charlemos-geometry-module"), true);
  assert.equal(classes.has("charlemos-geometry-native"), false);

  syncGeometryInteractionMode(viewElement, false);
  assert.equal(classes.has("charlemos-geometry-module"), false);
  assert.equal(classes.has("charlemos-geometry-native"), true);
});

test("syncTransparentFrameMode toggles native frame suppression class", () => {
  const classes = new Set();
  const viewElement = {
    classList: {
      toggle: (name, active) => {
        if (active) classes.add(name);
        else classes.delete(name);
      }
    }
  };

  syncTransparentFrameMode(viewElement, true);
  assert.equal(classes.has("charlemos-transparent-frame"), true);

  syncTransparentFrameMode(viewElement, false);
  assert.equal(classes.has("charlemos-transparent-frame"), false);
});

test("syncTransparentFrameClipPath mirrors clip-path onto visual camera layers", () => {
  const container = { style: {} };
  const overlay = { style: {} };
  const avatar = { style: {} };
  const viewElement = {
    querySelectorAll: () => [container, overlay, avatar]
  };

  syncTransparentFrameClipPath(viewElement, { clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }, true);

  assert.equal(container.style.clipPath, "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)");
  assert.equal(overlay.style.clipPath, "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)");
  assert.equal(avatar.style.clipPath, "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)");

  syncTransparentFrameClipPath(viewElement, null, false);

  assert.equal(container.style.clipPath, "");
  assert.equal(overlay.style.clipPath, "");
  assert.equal(avatar.style.clipPath, "");
});

test("syncTransparentFrameClipPath leaves an expanded overlay outside the camera clip", () => {
  const ownerDocument = testDocument();
  const view = ownerDocument.createElement("section");
  const container = ownerDocument.createElement("div");
  container.className = "video-container";
  const avatar = ownerDocument.createElement("img");
  avatar.className = "user-avatar";
  const overlay = ownerDocument.createElement("div");
  overlay.className = "charlemos-camera-overlay";
  overlay.style.clipPath = "circle(25%)";
  view.appendChild(container);
  view.appendChild(avatar);
  view.appendChild(overlay);

  syncTransparentFrameClipPath(view, { clipPath: "polygon(0 0, 100% 0, 100% 100%)" }, true, false);

  assert.equal(container.style.clipPath, "polygon(0 0, 100% 0, 100% 100%)");
  assert.equal(avatar.style.clipPath, "polygon(0 0, 100% 0, 100% 100%)");
  assert.equal(overlay.style.clipPath, "");
});

test("syncExpandedVideoViewport preserves and restores the native viewport styles", () => {
  const ownerDocument = testDocument();
  const { view, viewport } = cameraViewFixture(ownerDocument);

  const managed = syncExpandedVideoViewport(
    view,
    null,
    {
      clipPath: "polygon(0 0, 100% 0, 100% 80%, 0 100%)",
      geometry: { borderRadius: "14px" }
    },
    true
  );

  assert.equal(managed, viewport);
  assert.equal(viewport.classList.contains("charlemos-camera-viewport"), true);
  assert.equal(viewport.style.overflow, "hidden");
  assert.equal(viewport.style.borderRadius, "14px");
  assert.equal(viewport.style.clipPath, "");

  syncExpandedVideoViewport(view, null, null, false);

  assert.equal(viewport.classList.contains("charlemos-camera-viewport"), false);
  assert.equal(viewport.style.overflow, "auto");
  assert.equal(viewport.style.borderRadius, "3px");
  assert.equal(viewport.style.clipPath, "circle(50%)");
});

test("transformAwareClipPath keeps guided crop coordinates stable for mirrored cameras", () => {
  const mirror = "matrix(-1, 0, 0, 1, 0, 0)";
  assert.equal(transformAwareClipPath("inset(0% 10% 0% 0% round 0px)", mirror), "inset(0% 0% 0% 10% round 0px)");
  assert.equal(transformAwareClipPath("polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)", mirror), "polygon(100% 0%, 0% 0%, 0% 100%, 100% 100%)");
  assert.equal(transformAwareClipPath("url(#custom)", mirror), "url(#custom)");
});

test("resolveRelativeLayout places a camera below its target", () => {
  globalThis.foundry = {
    utils: {
      deepClone: (value) => JSON.parse(JSON.stringify(value))
    }
  };

  const layout = {
    position: "absolute",
    top: "0px",
    left: "0px",
    width: "300px",
    height: "160px",
    relative: {
      targetUserId: "u2",
      placement: "below",
      gap: "12px"
    }
  };
  const targetView = {
    offsetTop: 40,
    offsetLeft: 100,
    offsetWidth: 320,
    offsetHeight: 180,
    style: {}
  };
  const selfView = {
    offsetWidth: 300,
    offsetHeight: 160,
    style: {}
  };

  const resolved = resolveRelativeLayout(layout, targetView, selfView);

  assert.equal(resolved.position, "absolute");
  assert.equal(resolved.top, "232px");
  assert.equal(resolved.left, "100px");
  assert.equal(resolved.width, "300px");
});

test("applyGeometryDefaults falls back to foundry-sized camera bounds when no metrics are available", () => {
  const layout = {
    layoutMode: "absolute",
    position: "absolute",
    top: "",
    left: "",
    width: "",
    height: ""
  };
  const viewElement = {
    offsetWidth: 849,
    offsetHeight: 636,
    style: {}
  };
  const videoElement = {
    videoWidth: 0,
    videoHeight: 0
  };

  const resolved = applyGeometryDefaults(layout, viewElement, videoElement);

  assert.equal(resolved.top, "0px");
  assert.equal(resolved.left, "0px");
  assert.equal(resolved.width, "320px");
  assert.equal(resolved.height, "240px");
});

test("applyGeometryDefaults preserves explicit responsive geometry values", () => {
  const layout = {
    layoutMode: "absolute",
    position: "absolute",
    top: "16.5vh",
    left: "24.9vw",
    width: "25vw",
    height: "33.3vh"
  };
  const viewElement = {
    offsetWidth: 849,
    offsetHeight: 636,
    style: {}
  };
  const videoElement = {
    videoWidth: 0,
    videoHeight: 0
  };

  const resolved = applyGeometryDefaults(layout, viewElement, videoElement);

  assert.equal(resolved.top, "16.5vh");
  assert.equal(resolved.left, "24.9vw");
  assert.equal(resolved.width, "25vw");
  assert.equal(resolved.height, "33.3vh");
});

test("resolveRelativeLayout places a camera below-center its target", () => {
  globalThis.foundry = {
    utils: {
      deepClone: (value) => JSON.parse(JSON.stringify(value))
    }
  };

  const layout = {
    position: "absolute",
    top: "0px",
    left: "0px",
    width: "200px",
    height: "120px",
    relative: {
      targetUserId: "u2",
      placement: "below-center",
      gap: "10px"
    }
  };
  const targetView = {
    offsetTop: 40,
    offsetLeft: 100,
    offsetWidth: 320,
    offsetHeight: 180,
    style: {}
  };
  const selfView = {
    offsetWidth: 200,
    offsetHeight: 120,
    style: {}
  };

  const resolved = resolveRelativeLayout(layout, targetView, selfView);

  assert.equal(resolved.top, "230px");
  assert.equal(resolved.left, "160px");
});

test("resolveRelativeLayoutFromMetrics resolves against numeric metrics", () => {
  globalThis.foundry = {
    utils: {
      deepClone: (value) => JSON.parse(JSON.stringify(value))
    }
  };

  const resolved = resolveRelativeLayoutFromMetrics(
    {
      width: "200px",
      height: "120px",
      relative: {
        targetUserId: "u2",
        placement: "right-center",
        gap: "8px"
      }
    },
    { top: 40, left: 100, width: 320, height: 180 },
    { width: 200, height: 120 }
  );

  assert.equal(resolved.top, "70px");
  assert.equal(resolved.left, "428px");
});

test("resolveSceneLayouts resolves dependency chains in topological order", () => {
  globalThis.foundry = {
    utils: {
      deepClone: (value) => JSON.parse(JSON.stringify(value))
    }
  };

  const resolved = resolveSceneLayouts({
    a: {
      layoutMode: "absolute",
      position: "absolute",
      top: "10px",
      left: "20px",
      width: "300px",
      height: "150px"
    },
    b: {
      layoutMode: "relative",
      width: "200px",
      height: "100px",
      relative: {
        targetUserId: "a",
        placement: "below-center",
        gap: "10px"
      }
    },
    c: {
      layoutMode: "relative",
      width: "180px",
      height: "90px",
      relative: {
        targetUserId: "b",
        placement: "right-center",
        gap: "12px"
      }
    }
  });

  assert.equal(resolved.a.top, "10px");
  assert.equal(resolved.b.top, "170px");
  assert.equal(resolved.b.left, "70px");
  assert.equal(resolved.c.top, "175px");
  assert.equal(resolved.c.left, "282px");
});

test("resolveSceneLayouts falls back safely on cycles", () => {
  globalThis.foundry = {
    utils: {
      deepClone: (value) => JSON.parse(JSON.stringify(value))
    }
  };

  const resolved = resolveSceneLayouts({
    a: {
      layoutMode: "relative",
      top: "10px",
      left: "20px",
      width: "300px",
      height: "150px",
      relative: {
        targetUserId: "b",
        placement: "below-center",
        gap: "10px"
      }
    },
    b: {
      layoutMode: "relative",
      top: "40px",
      left: "60px",
      width: "200px",
      height: "100px",
      relative: {
        targetUserId: "a",
        placement: "right-center",
        gap: "12px"
      }
    }
  });

  assert.equal(resolved.a.top, "10px");
  assert.equal(resolved.a.left, "20px");
  assert.equal(resolved.b.top, "40px");
  assert.equal(resolved.b.left, "60px");
});

test("resolveSceneLayouts ignores dependencies on docked cameras", () => {
  globalThis.foundry = {
    utils: {
      deepClone: (value) => JSON.parse(JSON.stringify(value))
    }
  };

  const resolved = resolveSceneLayouts(
    {
      a: {
        layoutMode: "absolute",
        top: "10px",
        left: "20px",
        width: "300px",
        height: "150px"
      },
      b: {
        layoutMode: "relative",
        top: "40px",
        left: "60px",
        width: "200px",
        height: "100px",
        relative: {
          targetUserId: "a",
          placement: "below-center",
          gap: "10px"
        }
      }
    },
    {
      geometryEligibleByUserId: {
        a: false,
        b: true
      }
    }
  );

  assert.equal(resolved.b.top, "40px");
  assert.equal(resolved.b.left, "60px");
});

test("shouldBlockNativeGeometryInteraction blocks drag origins in module mode", () => {
  const controlBar = {};
  const target = {
    closest: (selector) => {
      if (selector.includes(".control-bar")) return null;
      if (selector.includes(".video-container")) return {};
      return null;
    }
  };
  globalThis.Element = Object;
  const viewElement = {
    classList: {
      contains: (name) => name === "charlemos-geometry-module"
    }
  };

  assert.equal(shouldBlockNativeGeometryInteraction(viewElement, target, controlBar), true);
});

test("shouldBlockNativeGeometryInteraction keeps native controls interactive", () => {
  const target = {
    closest: (selector) => {
      if (selector.includes(".control-bar")) return {};
      return null;
    }
  };
  globalThis.Element = Object;
  const viewElement = {
    classList: {
      contains: (name) => name === "charlemos-geometry-module"
    }
  };

  assert.equal(shouldBlockNativeGeometryInteraction(viewElement, target), false);
});

test("syncResizeHandleVisibility leaves native handle styling to CSS", () => {
  const handle = {
    style: {
      opacity: "0",
      pointerEvents: "none",
      cursor: "default"
    }
  };
  const viewElement = {
    querySelector: () => handle
  };

  syncResizeHandleVisibility(viewElement, false);

  assert.equal(handle.style.opacity, "");
  assert.equal(handle.style.pointerEvents, "");
  assert.equal(handle.style.cursor, "");
});

test("syncResizeHandleVisibility forces module handle hidden", () => {
  const handle = {
    style: {
      opacity: "",
      pointerEvents: "",
      cursor: ""
    }
  };
  const viewElement = {
    querySelector: () => handle
  };

  syncResizeHandleVisibility(viewElement, true);

  assert.equal(handle.style.opacity, "0");
  assert.equal(handle.style.pointerEvents, "none");
  assert.equal(handle.style.cursor, "default");
});

test("viewSupportsModuleGeometry only returns true for popout camera views", () => {
  const popoutView = {
    classList: {
      contains: (name) => name === "popout"
    },
    closest: () => null
  };
  const dockedView = {
    classList: {
      contains: () => false
    },
    closest: () => null
  };

  assert.equal(viewSupportsModuleGeometry(popoutView), true);
  assert.equal(viewSupportsModuleGeometry(dockedView), false);
});

test("prepareModuleGeometryForLayouts clicks dock toggle for docked module cameras", async () => {
  let clicked = 0;
  const viewElement = {
    classList: {
      contains: () => false
    },
    closest: () => null,
    querySelector: (selector) => (selector.includes("toggleDocked") ? { click: () => { clicked += 1; } } : null)
  };
  globalThis.ui = {
    webrtc: {
      getUserCameraView: () => viewElement,
      getUserVideoElement: () => ({})
    }
  };
  globalThis.window = {
    setTimeout: (fn) => {
      fn();
      return 1;
    }
  };

  const result = await prepareModuleGeometryForLayouts({ u1: { top: "10px" } });

  assert.equal(clicked, 1);
  assert.equal(result.attempted, 1);
  assert.equal(result.toggled, 1);
  assert.deepEqual(result.missing, []);
});

test("prepareModuleGeometryForLayouts skips cameras already supporting module geometry", async () => {
  let clicked = 0;
  const viewElement = {
    classList: {
      contains: (name) => name === "popout"
    },
    closest: () => null,
    querySelector: () => ({ click: () => { clicked += 1; } })
  };
  globalThis.ui = {
    webrtc: {
      getUserCameraView: () => viewElement,
      getUserVideoElement: () => ({})
    }
  };

  const result = await prepareModuleGeometryForLayouts({ u1: { top: "10px" } });

  assert.equal(clicked, 0);
  assert.equal(result.attempted, 0);
  assert.equal(result.toggled, 0);
  assert.deepEqual(result.missing, []);
});

test("prepareModuleGeometryForLayouts reports docked cameras without native toggle control", async () => {
  const viewElement = {
    classList: {
      contains: () => false
    },
    closest: () => null,
    querySelector: () => null
  };
  globalThis.ui = {
    webrtc: {
      getUserCameraView: () => viewElement,
      getUserVideoElement: () => ({})
    }
  };

  const result = await prepareModuleGeometryForLayouts({ u1: { top: "10px" } });

  assert.equal(result.attempted, 1);
  assert.equal(result.toggled, 0);
  assert.deepEqual(result.missing, ["u1"]);
});

test("resolveRelativeLayout still resolves legacy relative payloads", () => {
  globalThis.foundry = {
    utils: {
      deepClone: (value) => JSON.parse(JSON.stringify(value))
    }
  };

  const layout = {
    position: "absolute",
    top: "12px",
    left: "24px",
    width: "200px",
    height: "120px",
    relative: {
      targetUserId: "u2",
      placement: "below-center",
      gap: "10px"
    }
  };
  const targetView = {
    offsetTop: 40,
    offsetLeft: 100,
    offsetWidth: 320,
    offsetHeight: 180,
    style: {}
  };
  const selfView = {
    offsetWidth: 200,
    offsetHeight: 120,
    style: {}
  };

  const resolved = resolveRelativeLayout(layout, targetView, selfView);

  assert.equal(resolved.top, "230px");
  assert.equal(resolved.left, "160px");
});

test("expanded overlays use the camera ownerDocument and survive an avatar-only view", () => {
  const ownerDocument = testDocument();
  const first = cameraViewFixture(ownerDocument);
  const second = cameraViewFixture(ownerDocument);
  first.view.classList.add("popout");
  second.view.classList.add("popout");
  let currentView = first.view;
  const profile = {
    enabled: true,
    cameraControlMode: "module",
    layouts: {
      u1: {
        clipPath: "polygon(0 0, 100% 0, 100% 85%, 0 100%)",
        geometry: { borderRadius: "12px", transparentFrame: true },
        overlay: {
          enabled: true,
          imageUrl: "modules/example/frames/avatar-frame.png",
          opacity: 1,
          scale: 1,
          rotate: 0,
          bounds: { mode: "expanded", top: 20, right: 15, bottom: 30, left: 10 }
        },
        nameStyle: { enabled: false }
      }
    }
  };
  const profiles = { "scene-a": profile };
  const app = {
    getUserCameraView: () => currentView,
    getUserVideoElement: () => null
  };
  globalThis.Element = TestElement;
  globalThis.document = {
    createElement: () => {
      throw new Error("global document must not create camera overlay nodes");
    },
    querySelectorAll: () => []
  };
  globalThis.window = ownerDocument.defaultView;
  globalThis.canvas = { scene: { id: "scene-a" } };
  globalThis.ui = { webrtc: app };
  globalThis.game = {
    users: { contents: [{ id: "u1", name: "Player One" }] },
    settings: {
      get: (_moduleId, key) => {
        if (key === "sceneProfiles") return profiles;
        return false;
      }
    }
  };

  applyCameraLayoutsNow(app);
  ownerDocument.flushFrames();

  const firstOverlay = first.view.querySelector(".charlemos-camera-overlay");
  const createdAfterFirstApply = ownerDocument.created.length;
  assert.ok(firstOverlay);
  assert.equal(firstOverlay.ownerDocument, ownerDocument);
  assert.equal(firstOverlay.dataset.charlemosAnchorUserId, "u1");
  assert.equal(firstOverlay.dataset.charlemosSceneId, "scene-a");
  assert.equal(firstOverlay.getAttribute("aria-hidden"), "true");
  firstOverlay.querySelectorAll(".charlemos-camera-overlay-media, .charlemos-camera-overlay-tint").forEach((node) => {
    assert.equal(node.dataset.charlemosAnchorUserId, "u1");
    assert.equal(node.dataset.charlemosSceneId, "scene-a");
  });
  assert.equal(first.view.querySelectorAll(".charlemos-camera-overlay").length, 1);
  assert.equal(first.view.classList.contains("charlemos-overlay-expanded"), true);
  assert.equal(first.viewport.classList.contains("charlemos-camera-viewport"), true);
  assert.equal(first.avatar.parentElement, first.viewport);
  assert.equal(first.avatar.style.visibility, undefined);
  const snapshot = dumpRendererDebugSnapshot("u1", app);
  assert.equal(snapshot.layout.overlayBounds.mode, "expanded");
  assert.equal(snapshot.anchoredOverlay.userId, "u1");
  assert.equal(snapshot.anchoredOverlay.viewRect.width, 320);

  applyCameraLayoutsNow(app);
  ownerDocument.flushFrames();

  assert.equal(first.view.querySelector(".charlemos-camera-overlay"), firstOverlay);
  assert.equal(first.view.querySelectorAll(".charlemos-camera-overlay").length, 1);
  assert.equal(ownerDocument.created.length, createdAfterFirstApply);

  profiles["scene-b"] = profile;
  canvas.scene.id = "scene-b";
  applyCameraLayoutsNow(app);
  ownerDocument.flushFrames();

  assert.equal(firstOverlay.parentElement, first.view);
  assert.equal(firstOverlay.dataset.charlemosSceneId, "scene-b");
  assert.equal(first.view.querySelectorAll(".charlemos-camera-overlay").length, 1);

  currentView = second.view;
  applyCameraLayoutsNow(app);
  ownerDocument.flushFrames();

  const secondOverlay = second.view.querySelector(".charlemos-camera-overlay");
  assert.ok(secondOverlay);
  assert.notEqual(secondOverlay, firstOverlay);
  assert.equal(firstOverlay.parentElement, null);
  assert.equal(first.viewport.classList.contains("charlemos-camera-viewport"), false);
  assert.equal(first.viewport.style.overflow, "auto");
  assert.equal(second.view.querySelectorAll(".charlemos-camera-overlay").length, 1);

  profile.layouts.u1.overlay.bounds.mode = "camera";
  applyCameraLayoutsNow(app);

  assert.equal(second.viewport.classList.contains("charlemos-camera-viewport"), false);
  assert.equal(second.viewport.style.clipPath, profile.layouts.u1.clipPath);
  assert.equal(secondOverlay.style.clipPath, profile.layouts.u1.clipPath);

  profile.enabled = false;
  applyCameraLayoutsNow(app);

  assert.equal(secondOverlay.parentElement, null);
  assert.equal(second.view.querySelector(".charlemos-camera-overlay"), null);
  assert.equal(second.viewport.classList.contains("charlemos-camera-viewport"), false);
  assert.equal(second.viewport.style.overflow, "auto");
});

test("frame blend changes reuse owned media and restore legacy fallback without stale styles", () => {
  const doc = testDocument();
  const { view } = cameraViewFixture(doc);
  const overlay = { enabled: true, imageUrl: "modules/example/frames/art.png", tint: { enabled: true, color: "#ffffff", opacity: 0.5, blendMode: "multiply" } };
  const profile = { enabled: true, cameraControlMode: "native", layouts: { u1: { overlay } } };
  const app = { getUserCameraView: () => view, getUserVideoElement: () => null };
  globalThis.Element = TestElement;
  globalThis.document = { querySelectorAll: () => [] };
  globalThis.window = doc.defaultView;
  globalThis.canvas = { scene: { id: "blend-scene" } };
  globalThis.ui = { webrtc: app };
  globalThis.game = { users: { contents: [{ id: "u1", name: "Player" }] }, settings: { get: (_module, key) => key === "sceneProfiles" ? { "blend-scene": profile } : false } };
  let originalMedia;
  for (const blendMode of [undefined, "normal", "screen", "soft-light", "auto"]) {
    overlay.blendMode = blendMode;
    applyCameraLayoutsNow(app);
    const node = view.querySelector(".charlemos-camera-overlay");
    const media = node.querySelector(".charlemos-camera-overlay-media");
    originalMedia ??= media;
    assert.equal(media, originalMedia);
    assert.equal(node.style.mixBlendMode, !blendMode || blendMode === "auto" ? "screen" : blendMode);
    assert.equal(media.style.mixBlendMode, !blendMode || blendMode === "auto" ? "screen" : "normal");
    assert.equal(node.querySelector(".charlemos-camera-overlay-tint").style.mixBlendMode, "multiply");
  }
  profile.enabled = false;
  applyCameraLayoutsNow(app);
  assert.equal(view.querySelector(".charlemos-camera-overlay"), null);
});

test("global reconciliation applies an active CameraPopout instead of its stale dock view", () => {
  const ownerDocument = testDocument();
  const dock = cameraViewFixture(ownerDocument);
  const popped = cameraViewFixture(ownerDocument);
  const profile = {
    enabled: true,
    cameraControlMode: "native",
    layouts: {
      u1: {
        overlay: {
          enabled: true,
          imageUrl: "frame.png",
          bounds: { mode: "expanded", top: 10, right: 10, bottom: 10, left: 10 }
        }
      }
    }
  };
  class CameraPopout {
    constructor() {
      this.user = { id: "u1" };
      this.element = popped.view;
      this.rendered = true;
    }
  }
  const popout = new CameraPopout();
  const cameraViews = {
    popouts: [popout],
    getUserCameraView: () => dock.view,
    getUserVideoElement: () => null
  };
  globalThis.Element = TestElement;
  globalThis.document = ownerDocument;
  globalThis.window = ownerDocument.defaultView;
  globalThis.canvas = { scene: { id: "scene-popout" } };
  globalThis.ui = { webrtc: cameraViews };
  globalThis.game = {
    users: { contents: [{ id: "u1", name: "Player One" }] },
    settings: {
      get: (_moduleId, key) => key === "sceneProfiles" ? { "scene-popout": profile } : false
    }
  };

  applyCameraLayoutsNow(cameraViews);

  assert.equal(dock.view.querySelector(".charlemos-camera-overlay"), null);
  assert.ok(popped.view.querySelector(".charlemos-camera-overlay"));
  assert.equal(popped.view.classList.contains("charlemos-overlay-dock-spaced"), false);

  profile.enabled = false;
  applyCameraLayoutsNow(cameraViews);
  assert.equal(popped.view.querySelector(".charlemos-camera-overlay"), null);
});

test("a detached CameraViews dock still reserves expanded overlay spacing", () => {
  const ownerDocument = testDocument();
  const dock = cameraViewFixture(ownerDocument);
  dock.view.closest = (selector) => selector === ".application.popout" ? {} : null;
  const profile = {
    enabled: true,
    cameraControlMode: "native",
    layouts: {
      u1: {
        overlay: {
          enabled: true,
          imageUrl: "frame.png",
          bounds: { mode: "expanded", top: 10, right: 10, bottom: 10, left: 10 }
        }
      }
    }
  };
  const cameraViews = {
    popouts: [],
    getUserCameraView: () => dock.view,
    getUserVideoElement: () => null
  };
  globalThis.Element = TestElement;
  globalThis.document = ownerDocument;
  globalThis.window = ownerDocument.defaultView;
  globalThis.canvas = { scene: { id: "scene-detached-dock" } };
  globalThis.ui = { webrtc: cameraViews };
  globalThis.game = {
    users: { contents: [{ id: "u1", name: "Player One" }] },
    settings: {
      get: (_moduleId, key) => key === "sceneProfiles" ? { "scene-detached-dock": profile } : false
    }
  };

  applyCameraLayoutsNow(cameraViews);
  ownerDocument.flushFrames();

  assert.equal(dock.view.classList.contains("charlemos-overlay-dock-spaced"), true);

  profile.enabled = false;
  applyCameraLayoutsNow(cameraViews);
  assert.equal(dock.view.classList.contains("charlemos-overlay-dock-spaced"), false);
});
