import test from "node:test";
import assert from "node:assert/strict";
import { exportSceneProfileToMacro } from "../../scripts/macro-exporter.js";

function mockMacroEnv() {
  let created = null;
  globalThis.game = {
    i18n: {
      localize: (key) => key
    }
  };
  globalThis.Macro = {
    create: async (data) => {
      created = data;
      return { id: "macro-1", ...data };
    }
  };
  return {
    getCreated: () => created
  };
}

test("exportSceneProfileToMacro creates load-only macro command", async () => {
  const env = mockMacroEnv();

  const macro = await exportSceneProfileToMacro(
    "scene-a",
    { cameraControlMode: "native", layouts: { u1: { filter: "blur(1px)" } } },
    "Scene Draft"
  );
  const created = env.getCreated();

  assert.equal(macro.id, "macro-1");
  assert.equal(created.name, "Scene Draft");
  assert.equal(created.command.includes("loadSceneProfileDraft"), true);
  assert.equal(created.command.includes("applySceneProfile"), false);
  assert.equal(created.command.includes('"cameraControlMode": "native"'), true);
});
