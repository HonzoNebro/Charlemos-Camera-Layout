import test from "node:test";
import assert from "node:assert/strict";
import { buildSceneLayoutPreset, getSceneLayoutPresetIds } from "../../scripts/scene-layout-presets.js";

test("getSceneLayoutPresetIds includes grid and narrative presets", () => {
  const ids = getSceneLayoutPresetIds();
  assert.equal(ids.includes("grid2x3"), true);
  assert.equal(ids.includes("grid1x6"), true);
  assert.equal(ids.includes("roleplayWide"), true);
  assert.equal(ids.includes("mapBottomStrip"), true);
  assert.equal(ids.includes("sideDock"), true);
});

test("buildSceneLayoutPreset creates a responsive 2x2 grid in row-major order", () => {
  const result = buildSceneLayoutPreset(["u1", "u2", "u3", "u4"], "grid2x2", {
    unitMode: "responsive",
    gap: 2,
    marginX: 2,
    marginY: 3
  });

  assert.equal(result.unitMode, "responsive");
  assert.deepEqual(result.ignoredUserIds, []);
  assert.deepEqual(result.layouts.u1, {
    position: "absolute",
    top: "3vh",
    left: "2vw",
    width: "47vw",
    height: "46vh",
    relative: {
      targetUserId: null,
      placement: "none",
      gap: null
    }
  });
  assert.equal(result.layouts.u2.left, "51vw");
  assert.equal(result.layouts.u3.top, "51vh");
});

test("buildSceneLayoutPreset can still use pixel units", () => {
  const result = buildSceneLayoutPreset(["u1", "u2", "u3", "u4"], "grid2x2", {
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
  const result = buildSceneLayoutPreset(["u1", "u2", "u3"], "grid1x2", {
    unitMode: "responsive",
    gap: 2,
    marginX: 2,
    marginY: 2
  });

  assert.equal(result.capacity, 2);
  assert.deepEqual(result.ignoredUserIds, ["u3"]);
});
