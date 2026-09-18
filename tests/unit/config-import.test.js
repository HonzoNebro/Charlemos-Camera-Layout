import test from "node:test";
import assert from "node:assert/strict";
import { inspectConfigurationImport, prepareConfigurationImport, remapConfigurationImport, importReferences, importEntries, selectImportEntries } from "../../scripts/config-import.js";

test("frame blend survives JSON round trips and omitted fields remain omitted", () => {
  for (const blendMode of ["normal", "screen", "soft-light", "auto", "invalid", undefined]) {
    const payload = JSON.parse(JSON.stringify({ version: 2, settings: { sceneProfiles: { a: { layouts: { u: { overlay: { blendMode, imageUrl: "frame.webm", tint: { blendMode: "multiply" } } } } } } } }));
    const result = inspectConfigurationImport(payload).settings.sceneProfiles.a.layouts.u.overlay;
    assert.equal(result.blendMode, blendMode === "invalid" ? "auto" : blendMode);
    assert.equal(result.tint.blendMode, "multiply");
    assert.equal(Object.hasOwn(result, "blendMode"), blendMode !== undefined);
  }
});

test("rejects unrelated, malformed, incompatible and unsafe imports", () => {
  for (const value of [{}, [], { settings: {} }, { moduleId: "other", playerLayouts: {} }, { version: 3, playerLayouts: {} }, { playerLayouts: [] }, { sceneProfiles: { a: [] } }, { playerLayouts: { u: 4 } }, JSON.parse('{"playerLayouts":{"__proto__":{}}}')]) {
    assert.equal(inspectConfigurationImport(value), null);
  }
});

test("legacy, v1 and v2 keep inactive geometry and custom properties", () => {
  for (const version of [undefined, 1, 2]) {
    const result = inspectConfigurationImport({ version, settings: { sceneProfiles: { a: { cameraControlMode: "native", custom: 1, layouts: { u: { left: "12vw", geometry: { custom: 2 }, overlay: { enabled: true } } } } } } });
    assert.equal(result.settings.sceneProfiles.a.layouts.u.left, "12vw");
    assert.equal(result.settings.sceneProfiles.a.layouts.u.geometry.custom, 2);
    assert.equal(result.settings.sceneProfiles.a.custom, 1);
  }
});

test("merge changes included fields only and replacing cameras preserves unselected cameras", () => {
  const current = { sceneProfiles: { a: { enabled: true, cameraControlMode: "module", layouts: { u: { left: "12px", overlay: { enabled: true, imageUrl: "frame.png" } }, other: { filter: "blur(1px)" } } }, untouched: {} }, sceneCamera: { a: { playerId: "other" } } };
  const inspection = inspectConfigurationImport({ sceneProfiles: { a: { layouts: { u: { overlay: { enabled: false } } } } } });
  const merge = prepareConfigurationImport(inspection, current);
  assert.equal(merge.writes.length, 1);
  assert.equal(merge.writes[0].after.a.layouts.u.overlay.imageUrl, "frame.png");
  assert.equal(merge.writes[0].after.a.layouts.u.left, "12px");
  const replacement = prepareConfigurationImport(inspection, current, { mode: "replace" });
  assert.deepEqual(replacement.writes[0].after.a.layouts.u, { overlay: { enabled: false } });
  assert.deepEqual(replacement.writes[0].after.a.layouts.other, current.sceneProfiles.a.layouts.other);
  assert.deepEqual(current.sceneCamera, { a: { playerId: "other" } });
});

test("only complete explicit backups can restore an empty world configuration", () => {
  const partial = inspectConfigurationImport({ playerLayouts: {} });
  assert.throws(() => prepareConfigurationImport(partial, {}, { mode: "restore" }));
  const complete = inspectConfigurationImport({ playerLayouts: {}, sceneProfiles: {}, sceneCamera: {} });
  const plan = prepareConfigurationImport(complete, { sceneProfiles: { a: {} } }, { mode: "restore" });
  assert.deepEqual(plan.writes[0].after, {});
  assert.equal(plan.changes[0].after, undefined);
});

test("mapping is explicit, includes relatives, detects collisions and supports exclusion", () => {
  const inspection = inspectConfigurationImport({ sceneProfiles: { old: { layouts: { a: { relative: { targetUserId: "b" } }, b: {} } } }, sceneCamera: { old: { playerId: "a" } } });
  assert.deepEqual(importReferences(inspection), { scenes: ["old"], users: ["a", "b"] });
  assert.throws(() => remapConfigurationImport(inspection, { scenes: { old: "new" }, users: { a: "u", b: "u" } }));
  assert.throws(() => remapConfigurationImport(inspection, { scenes: { old: "new" }, users: { a: "u", b: "" } }));
  const mapped = remapConfigurationImport(inspection, { scenes: { old: "new" }, users: { a: "u", b: "v" } });
  assert.equal(mapped.settings.sceneProfiles.new.layouts.u.relative.targetUserId, "v");
  assert.equal(mapped.settings.sceneCamera.new.playerId, "u");
});
test("camera selection is independent per scene and preserves excluded destination cameras", () => {
  const inspection = inspectConfigurationImport({ sceneProfiles: { a: { layouts: { u: { filter: "blur(1px)" } } }, b: { layouts: { u: { filter: "blur(2px)" } } } } });
  assert.equal(importEntries(inspection).length, 2);
  const selected = selectImportEntries(inspection, [["sceneProfiles", "a", "layouts", "u"]]);
  const current = { sceneProfiles: { a: { layouts: { u: { filter: "brightness(2)" } } }, b: { layouts: { u: {} } } } };
  const plan = prepareConfigurationImport(selected, current, { mode: "replace" });
  assert.equal(plan.writes[0].after.a.layouts.u.filter, "brightness(2)");
  assert.equal(plan.writes[0].after.b.layouts.u.filter, "blur(2px)");
});
test("partial background imports preserve omitted fit while explicit null deletes a source", () => {
  const current = { sceneCamera: { a: { playerId: "u", fit: "contain" }, b: { playerId: "u", fit: "fill" } } };
  const inspection = inspectConfigurationImport({ sceneCamera: { a: { playerId: "v" }, b: null } });
  const plan = prepareConfigurationImport(inspection, current);
  assert.deepEqual(plan.writes[0].after, { a: { playerId: "v", fit: "contain" } });
  assert.deepEqual(importReferences(inspection).users, ["v"]);
});
