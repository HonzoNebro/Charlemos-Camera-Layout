import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
const { copyCameraCategories, compositionWithPreset, presetResult } = await import("../../scripts/editor-compositions.js");

test("copying appearance preserves geometry and binds overlays to destination identity", () => {
  const source = { left: "10px", overlay: { enabled: true, userId: "source", bounds: { mode: "expanded", bottom: 20 } } };
  const target = { left: "40vw", nameStyle: { custom: 1 } };
  const result = copyCameraCategories(target, source, ["overlay"]);
  assert.equal(result.left, "40vw");
  assert.equal(result.overlay.userId, undefined);
  assert.equal(result.overlay.bounds.bottom, 20);
  assert.deepEqual(result.nameStyle, { custom: 1 });
  assert.equal(source.overlay.userId, "source");
});

test("presets preserve appearance and unused cameras", () => {
  const profile = { cameraControlMode: "native", layouts: { u: { overlay: { enabled: true } }, other: { left: "10px" } } };
  const built = presetResult({ users: ["u"], rows: 1, cols: 1, unitMode: "responsive" }, { innerWidth: 1000, innerHeight: 800 });
  const next = compositionWithPreset(profile, built);
  assert.equal(next.cameraControlMode, "module");
  assert.equal(next.layouts.u.overlay.enabled, true);
  assert.equal(next.layouts.other.left, "10px");
  assert.equal(profile.cameraControlMode, "native");
});
