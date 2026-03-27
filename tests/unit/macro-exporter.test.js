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

test("exportSceneProfileToMacro creates apply-scene macro command", async () => {
  const env = mockMacroEnv();

  const macro = await exportSceneProfileToMacro(
    "scene-a",
    { cameraControlMode: "native", layouts: { u1: { filter: "blur(1px)" } } },
    "Scene Draft"
  );
  const created = env.getCreated();

  assert.equal(macro.id, "macro-1");
  assert.equal(created.name, "Scene Draft");
  assert.equal(created.command.includes("applySceneProfileDraft"), true);
  assert.equal(created.command.includes("loadSceneProfileDraft"), false);
  assert.equal(created.command.includes("const sceneId = canvas.scene?.id;"), true);
  assert.equal(created.command.includes('"scene-a"'), false);
  assert.equal(created.command.includes('"cameraControlMode": "native"'), true);
});

test("exportSceneProfileToMacro also supports profile-first signature", async () => {
  const env = mockMacroEnv();

  await exportSceneProfileToMacro(
    { cameraControlMode: "module", layouts: { u1: { top: "10px" } } },
    "Scene Draft"
  );
  const created = env.getCreated();

  assert.equal(created.name, "Scene Draft");
  assert.equal(created.command.includes('"cameraControlMode": "module"'), true);
  assert.equal(created.command.includes('"top": "10px"'), true);
});
