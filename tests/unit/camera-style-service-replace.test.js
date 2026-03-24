import test from "node:test";
import assert from "node:assert/strict";
import { getPlayerLayout, replacePlayerLayout } from "../../scripts/camera-style-service.js";

function installSettings(initialLayouts) {
  const store = {
    playerLayouts: initialLayouts ?? {}
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

test("replacePlayerLayout overwrites existing layout object", async () => {
  installSettings({
    u1: {
      position: "absolute",
      top: "100px",
      filter: "blur(1px)",
      crop: { top: "10px" }
    }
  });

  await replacePlayerLayout("u1", {
    filter: "contrast(1.2)",
    crop: { top: "0px" }
  });

  assert.deepEqual(getPlayerLayout("u1"), {
    filter: "contrast(1.2)",
    crop: { top: "0px" }
  });
});
