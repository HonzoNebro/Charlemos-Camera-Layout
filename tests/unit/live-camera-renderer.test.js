import test from "node:test";
import assert from "node:assert/strict";
import {
  applyFrameOverlayFallbackStyle,
  dumpRendererDebugSnapshot,
  isFrameOverlayPath,
  isRendererDebugEnabled,
  resolveRelativeLayout,
  resolveRelativeLayoutFromMetrics,
  resolveSceneLayouts,
  shouldBlockNativeGeometryInteraction,
  syncOverlayMediaSource,
  syncResizeHandleVisibility,
  syncGeometryInteractionMode,
  syncManagedViewGeometry,
  syncFoundryAvatarVisibility,
  viewSupportsModuleGeometry,
  videoStyle
} from "../../scripts/live-camera-renderer.js";

function viewWith(nodes) {
  return {
    querySelectorAll: () => nodes
  };
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

test("isFrameOverlayPath detects frame asset paths", () => {
  assert.equal(isFrameOverlayPath("modules/falemos/assets/img/frames/elegant.png"), true);
  assert.equal(isFrameOverlayPath("assets/overlays/neon-corners.svg"), false);
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
      position: "",
      top: "",
      left: "",
      width: "",
      height: ""
    },
    dataset: {}
  };

  syncManagedViewGeometry(moduleView, { position: "absolute", top: "8px", left: "12px", width: "300px", height: "160px" }, true);
  assert.equal(moduleView.dataset.charlemosGeometryManaged, "1");
  assert.equal(moduleView.style.top, "8px");

  syncManagedViewGeometry(moduleView, {}, false);
  assert.equal(moduleView.dataset.charlemosGeometryManaged, undefined);
  assert.equal(moduleView.style.position, "");
  assert.equal(moduleView.style.top, "");
  assert.equal(moduleView.style.left, "");
  assert.equal(moduleView.style.width, "");
  assert.equal(moduleView.style.height, "");
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
