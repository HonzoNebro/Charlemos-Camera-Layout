import test from "node:test";
import assert from "node:assert/strict";

async function importOverlayModule() {
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {}
      }
    }
  };
  return import(`../../scripts/overlay-config-app.js?test=${Date.now()}-${Math.random()}`);
}

test("buildOverlayPatch keeps only overlay-specific fields", async () => {
  const { buildOverlayPatch } = await importOverlayModule();
  const patch = buildOverlayPatch({
    layoutMode: "absolute",
    top: "10px",
    left: "20px",
    width: "320px",
    height: "180px",
    relativeTargetUserId: "u2",
    relativePlacement: "below-center",
    relativeGap: "12px",
    cropTop: "5px",
    cropRight: "",
    cropBottom: "",
    cropLeft: "",
    transform: "rotate(3deg)",
    filter: "blur(1px)",
    clipPath: "circle(45%)",
    overlayEnabled: true,
    overlayImage: "modules/example/frame.png",
    overlayOpacity: "0.75",
    overlayOffsetX: "10",
    overlayOffsetY: "-4%",
    overlayScale: "1.2",
    overlayRotate: "15",
    overlayFitMode: "contain",
    overlayAnchor: "bottom-right",
    overlayTintEnabled: true,
    overlayTintColor: "#112233",
    overlayTintOpacity: "0.5",
    overlayTintBlendMode: "screen",
    nameVisible: true,
    geometryBorderRadius: "12px",
    geometryTransparentFrame: true
  });

  assert.deepEqual(patch, {
    overlay: {
      enabled: true,
      imageUrl: "modules/example/frame.png",
      opacity: 0.75,
      offset: {
        x: "10px",
        y: "-4%"
      },
      scale: 1.2,
      rotate: 15,
      fitMode: "contain",
      anchor: "bottom-right",
      tint: {
        enabled: true,
        color: "#112233",
        opacity: 0.5,
        blendMode: "screen"
      }
    }
  });
});
