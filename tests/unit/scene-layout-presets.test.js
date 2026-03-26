import test from "node:test";
import assert from "node:assert/strict";
import { buildSceneLayoutPreset, getSceneLayoutPresetIds } from "../../scripts/scene-layout-presets.js";

test("getSceneLayoutPresetIds includes grid presets", () => {
  const ids = getSceneLayoutPresetIds();
  assert.equal(ids.includes("grid2x3"), true);
  assert.equal(ids.includes("grid2x4"), true);
});

test("buildSceneLayoutPreset creates a 2x2 grid in row-major order", () => {
  const result = buildSceneLayoutPreset(["u1", "u2", "u3", "u4"], "grid2x2", {
    viewportWidth: 1000,
    viewportHeight: 600,
    gap: 10,
    marginX: 20,
    marginY: 30
  });

  assert.deepEqual(result.ignoredUserIds, []);
  assert.deepEqual(result.layouts.u1, {
    position: "absolute",
    top: "30px",
    left: "20px",
    width: "475px",
    height: "265px",
    relative: {
      targetUserId: null,
      placement: "none",
      gap: null
    }
  });
  assert.equal(result.layouts.u2.left, "505px");
  assert.equal(result.layouts.u3.top, "305px");
});

test("buildSceneLayoutPreset ignores users beyond preset capacity", () => {
  const result = buildSceneLayoutPreset(["u1", "u2", "u3"], "grid1x2", {
    viewportWidth: 800,
    viewportHeight: 400,
    gap: 8,
    marginX: 8,
    marginY: 8
  });

  assert.equal(result.capacity, 2);
  assert.deepEqual(result.ignoredUserIds, ["u3"]);
});
