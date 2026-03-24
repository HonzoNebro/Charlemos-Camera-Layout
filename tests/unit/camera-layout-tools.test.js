import test from "node:test";
import assert from "node:assert/strict";
import { applyPresetToLayoutPatch, applySnapToLayoutPatch, getPresetIds } from "../../scripts/camera-layout-tools.js";

test("getPresetIds includes compact presets", () => {
  const ids = getPresetIds();
  assert.equal(ids.includes("compactBottom"), true);
  assert.equal(ids.includes("compactSide"), true);
});

test("applyPresetToLayoutPatch applies topRight coordinates", () => {
  const patch = applyPresetToLayoutPatch(
    { preset: "topRight", top: null, left: null, width: "300px", height: "200px" },
    "topRight"
  );
  assert.deepEqual(
    { top: patch.top, left: patch.left, width: patch.width, height: patch.height, position: patch.position },
    {
      position: "absolute",
      top: "8px",
      left: "calc(100vw - 22vw - 8px)",
      width: "300px",
      height: "200px"
    }
  );
});

test("applySnapToLayoutPatch snaps px and numeric values", () => {
  const patch = applySnapToLayoutPatch({
    snap: { enabled: true, size: 10 },
    top: "23px",
    left: "31",
    width: "99px",
    height: "20vh"
  });

  assert.deepEqual(
    { top: patch.top, left: patch.left, width: patch.width, height: patch.height, grid: patch.snap.size },
    {
      top: "20px",
      left: "30",
      width: "99px",
      height: "20vh",
      grid: 10
    }
  );
});
