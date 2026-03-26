import test from "node:test";
import assert from "node:assert/strict";
import {
  applyFrameOverlayFallbackStyle,
  dumpRendererDebugSnapshot,
  isFrameOverlayPath,
  isRendererDebugEnabled,
  syncFoundryAvatarVisibility,
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
