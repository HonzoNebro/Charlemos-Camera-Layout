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
    unitMode: "responsive",
    gap: 2,
    marginX: 2,
    marginY: 3
  });

  assert.equal(result.layoutType, "grid");
  assert.equal(result.rows, 2);
  assert.equal(result.cols, 2);
  assert.equal(result.unitMode, "responsive");
  assert.equal(result.layouts.u1.left, "2vw");
  assert.equal(result.layouts.u2.left, "51vw");
  assert.equal(result.layouts.u3.top, "51vh");
});

test("buildSceneLayoutPreset creates narrative preset layouts", () => {
  const result = buildSceneLayoutPreset(["u1", "u2", "u3"], {
    layoutType: "narrative",
    presetId: "sideDock",
    unitMode: "responsive",
    gap: 2,
    marginX: 2,
    marginY: 2
  });

  assert.equal(result.layoutType, "narrative");
  assert.equal(result.rows, 4);
  assert.equal(result.cols, 1);
  assert.equal(result.layouts.u2.top, "26.5vh");
});

test("buildSceneLayoutPreset can still use pixel units", () => {
  const result = buildSceneLayoutPreset(["u1", "u2", "u3", "u4"], {
    layoutType: "grid",
    rows: 2,
    cols: 2,
    unitMode: "px",
    viewportWidth: 1000,
    viewportHeight: 600,
    gap: 10,
    marginX: 20,
    marginY: 30
  });

  assert.equal(result.unitMode, "px");
  assert.equal(result.layouts.u1.left, "20px");
  assert.equal(result.layouts.u1.width, "475px");
  assert.equal(result.layouts.u3.top, "305px");
});

test("buildSceneLayoutPreset ignores users beyond preset capacity", () => {
  const result = buildSceneLayoutPreset(["u1", "u2", "u3"], {
    layoutType: "grid",
    rows: 1,
    cols: 2,
    unitMode: "responsive",
    gap: 2,
    marginX: 2,
    marginY: 2
  });

  assert.equal(result.capacity, 2);
  assert.deepEqual(result.ignoredUserIds, ["u3"]);
});
