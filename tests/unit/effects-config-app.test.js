import test from "node:test";
import assert from "node:assert/strict";
async function importEffectsModule() {
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {}
      }
    }
  };
  return import(`../../scripts/effects-config-app.js?test=${Date.now()}-${Math.random()}`);
}

test("buildEffectsPatch keeps only effects-specific fields", async () => {
  const { buildEffectsPatch } = await importEffectsModule();
  const patch = buildEffectsPatch({
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
    nameVisible: true,
    geometryBorderRadius: "12px",
    geometryTransparentFrame: true
  });

  assert.deepEqual(patch, {
    transform: "rotate(3deg)",
    filter: "blur(1px)",
    clipPath: "circle(45%)",
    geometry: {
      borderRadius: "12px",
      transparentFrame: true
    }
  });
});
