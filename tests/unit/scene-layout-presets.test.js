import test from "node:test";
import assert from "node:assert/strict";
import { buildSceneLayoutPreset, getNarrativeSceneLayoutPresetIds } from "../../scripts/scene-layout-presets.js";

test("getNarrativeSceneLayoutPresetIds includes expected presets", () => {
  const ids = getNarrativeSceneLayoutPresetIds();
  assert.deepEqual(ids, ["roleplayWide", "mapBottomStrip", "sideDock"]);
});

test("buildSceneLayoutPreset creates a responsive dynamic 2x2 grid", () => {
  const result = buildSceneLayoutPreset(["u1", "u2", "u3", "u4"], {
    layoutType: "grid",
    rows: 2,
    cols: 2,
    aspectRatio: "4:3",
    unitMode: "responsive",
    feedWidth: 320,
    feedHeight: 240,
    gap: 2,
    marginX: 2,
    marginY: 3
  });

  assert.equal(result.layoutType, "grid");
  assert.equal(result.rows, 2);
  assert.equal(result.cols, 2);
  assert.equal(result.aspectRatio, "4:3");
  assert.equal(result.unitMode, "responsive");
  assert.equal(result.layouts.u1.left, "24.9219vw");
  assert.equal(result.layouts.u2.left, "50.0781vw");
  assert.equal(result.layouts.u3.top, "50.1389vh");
});

test("buildSceneLayoutPreset creates narrative preset layouts", () => {
  const result = buildSceneLayoutPreset(["u1", "u2", "u3"], {
    layoutType: "narrative",
    presetId: "sideDock",
    aspectRatio: "4:3",
    unitMode: "responsive",
    feedWidth: 320,
    feedHeight: 240,
    gap: 2,
    marginX: 2,
    marginY: 2
  });

  assert.equal(result.layoutType, "narrative");
  assert.equal(result.rows, 4);
  assert.equal(result.cols, 1);
  assert.equal(result.layouts.u2.top, "25.2083vh");
});

test("buildSceneLayoutPreset can still use pixel units", () => {
  const result = buildSceneLayoutPreset(["u1", "u2", "u3", "u4"], {
    layoutType: "grid",
    rows: 2,
    cols: 2,
    aspectRatio: "4:3",
    unitMode: "px",
    feedWidth: 320,
    feedHeight: 240,
    viewportWidth: 1000,
    viewportHeight: 600,
    gap: 10,
    marginX: 20,
    marginY: 30
  });

  assert.equal(result.aspectRatio, "4:3");
  assert.equal(result.unitMode, "px");
  assert.equal(result.layouts.u1.left, "175px");
  assert.equal(result.layouts.u1.width, "320px");
  assert.equal(result.layouts.u3.top, "305px");
});

test("buildSceneLayoutPreset ignores users beyond preset capacity", () => {
  const result = buildSceneLayoutPreset(["u1", "u2", "u3"], {
    layoutType: "grid",
    rows: 1,
    cols: 2,
    aspectRatio: "4:3",
    unitMode: "responsive",
    feedWidth: 320,
    feedHeight: 240,
    gap: 2,
    marginX: 2,
    marginY: 2
  });

  assert.equal(result.capacity, 2);
  assert.deepEqual(result.ignoredUserIds, ["u3"]);
});

test("buildSceneLayoutPreset defaults to 4:3 fallback instead of square when no feed is available", () => {
  const result = buildSceneLayoutPreset(["u1"], {
    layoutType: "grid",
    rows: 1,
    cols: 1,
    unitMode: "px",
    viewportWidth: 1000,
    viewportHeight: 600,
    gap: 0,
    marginX: 20,
    marginY: 20
  });

  assert.equal(result.aspectRatio, "4:3");
  assert.equal(result.layouts.u1.width, "320px");
  assert.equal(result.layouts.u1.height, "240px");
});

test("buildSceneLayoutPreset can generate square layouts when requested", () => {
  const result = buildSceneLayoutPreset(["u1"], {
    layoutType: "grid",
    rows: 1,
    cols: 1,
    aspectRatio: "1:1",
    unitMode: "px",
    feedWidth: 320,
    feedHeight: 240,
    viewportWidth: 1000,
    viewportHeight: 600,
    gap: 0,
    marginX: 20,
    marginY: 20
  });

  assert.equal(result.aspectRatio, "1:1");
  assert.equal(result.layouts.u1.width, "240px");
  assert.equal(result.layouts.u1.height, "240px");
});
