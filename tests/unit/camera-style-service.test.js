import test from "node:test";
import assert from "node:assert/strict";
import { buildCameraViewStyle, buildVideoStyle, getAllPlayerLayouts, removePlayerLayout } from "../../scripts/camera-style-service.js";

function installSettings(initialLayouts = {}) {
  const store = {
    playerLayouts: initialLayouts
  };
  globalThis.game = {
    settings: {
      get: (_moduleId, key) => store[key],
      set: async (_moduleId, key, value) => {
        store[key] = value;
        return value;
      }
    }
  };
  globalThis.foundry = {
    utils: {
      deepClone: (value) => JSON.parse(JSON.stringify(value))
    }
  };
  return store;
}

test("buildVideoStyle returns only supported style keys", () => {
  const result = buildVideoStyle({
    position: "absolute",
    top: "10px",
    left: "20px",
    width: "320px",
    height: "180px",
    transform: "rotate(2deg)",
    filter: "grayscale(0.3)",
    clipPath: "circle(45%)",
    overlay: "ignored"
  });

  assert.deepEqual(result, {
    transform: "rotate(2deg)",
    filter: "grayscale(0.3)",
    clipPath: "circle(45%)"
  });
});

test("buildCameraViewStyle returns only geometry ownership keys", () => {
  const result = buildCameraViewStyle({
    position: "absolute",
    top: "10px",
    left: "20px",
    width: "320px",
    height: "180px",
    transform: "rotate(2deg)",
    filter: "grayscale(0.3)"
  });

  assert.deepEqual(result, {
    position: "absolute",
    top: "10px",
    left: "20px",
    width: "320px",
    height: "180px"
  });
});

test("removePlayerLayout deletes only the selected player layout", async () => {
  installSettings({
    u1: { filter: "blur(1px)" },
    u2: { clipPath: "circle(45%)" }
  });

  const removed = await removePlayerLayout("u1");

  assert.equal(removed, true);
  assert.deepEqual(getAllPlayerLayouts(), {
    u2: { clipPath: "circle(45%)" }
  });
});
