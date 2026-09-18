import test from "node:test";
import assert from "node:assert/strict";
import { sceneProfileEntries, duplicateSceneComposition, uniqueCompositionMacroName } from "../../scripts/editor-profiles.js";

test("profile listing identifies scenes and missing users by ID, including duplicate names", () => {
  const entries = sceneProfileEntries({ b: { enabled: true, layouts: { unknown: {} } }, a: { layouts: { u: {} } }, removed: {} }, [{ id: "b", name: "Same" }, { id: "a", name: "Same" }], [{ id: "u" }]);
  assert.deepEqual(entries.map((entry) => entry.id), ["a", "b", "removed"]);
  assert.deepEqual(entries[1].missingUsers, ["unknown"]);
  assert.equal(entries[2].missing, true);
});

test("duplication clones complete camera compositions and preserves unrelated destination data", () => {
  const source = { cameraControlMode: "module", layouts: { u: { left: "3vw", overlay: { blendMode: "normal", userId: "wrong" } } } };
  const destination = { custom: 42, layouts: { v: { filter: "custom" }, u: { width: "40px" } } };
  const before = structuredClone({ source, destination });
  const result = duplicateSceneComposition(source, destination, [{ id: "u" }, { id: "v" }]);
  assert.deepEqual(result.replaced, ["u"]);
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.profile.layouts.v, destination.layouts.v);
  assert.equal(result.profile.layouts.u.width, undefined);
  assert.equal(result.profile.layouts.u.overlay.userId, undefined);
  assert.equal(result.profile.custom, 42);
  assert.equal(result.profile.cameraControlMode, "module");
  assert.deepEqual({ source, destination }, before);
  result.profile.layouts.u.left = "0px";
  assert.equal(source.layouts.u.left, "3vw");
  assert.throws(() => duplicateSceneComposition(source, {}, []), /profileMissingUsers/);
  assert.throws(() => duplicateSceneComposition({}, {}, []), /profileEmpty/);
});

test("macro names describe scene and saved/draft state and avoid existing names", () => {
  assert.equal(uniqueCompositionMacroName("Tavern", "Draft", ["Tavern — Draft", "Tavern — Draft (2)"], "Composition"), "Tavern — Draft (3)");
  assert.equal(uniqueCompositionMacroName("", "Saved", [], "Composition"), "Composition — Saved");
});
