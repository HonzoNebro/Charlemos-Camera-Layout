import test from "node:test";
import assert from "node:assert/strict";
import { clearLoadedSceneProfileDraft, getLoadedSceneProfileDraft, setLoadedSceneProfileDraft } from "../../scripts/state.js";

test("scene draft state stores, reads and clears by scene", () => {
  clearLoadedSceneProfileDraft();

  setLoadedSceneProfileDraft("scene-a", { u1: { clipPath: "circle(45%)" } });
  setLoadedSceneProfileDraft("scene-b", { u2: { filter: "blur(1px)" } });

  assert.deepEqual(getLoadedSceneProfileDraft("scene-a")?.layouts, { u1: { clipPath: "circle(45%)" } });
  assert.deepEqual(getLoadedSceneProfileDraft("scene-b")?.layouts, { u2: { filter: "blur(1px)" } });

  clearLoadedSceneProfileDraft("scene-a");

  assert.equal(getLoadedSceneProfileDraft("scene-a"), null);
  assert.deepEqual(getLoadedSceneProfileDraft("scene-b")?.layouts, { u2: { filter: "blur(1px)" } });
});
