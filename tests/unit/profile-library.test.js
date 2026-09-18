import test from "node:test";
import assert from "node:assert/strict";
import { templateFromProfile, normalizeProfileLibrary, profileWithTemplate, templateUserIds, writeProfileTemplate } from "../../scripts/profile-library.js";

function composition() {
  return { enabled: false, cameraControlMode: "native", background: { playerId: "a" }, layouts: {
    a: { left: "calc(5vw + 2px)", filter: "url(#custom)", geometry: { custom: 42 }, overlay: { enabled: false, imageUrl: "art.webm", blendMode: "soft-light", bounds: { mode: "expanded", top: 12.5 }, userId: "wrong" } },
    b: { layoutMode: "relative", relative: { targetUserId: "a", placement: "right-of", gap: "2vw" } }
  } };
}

test("templates preserve camera configuration without scene/background coupling or duplicate identities", () => {
  const source = composition();
  const before = structuredClone(source);
  const entry = templateFromProfile("  Shared  ", source);
  assert.equal(entry.name, "Shared");
  assert.equal(entry.revision, 1);
  assert.equal(entry.profile.background, undefined);
  assert.equal(entry.profile.enabled, undefined);
  assert.equal(entry.profile.layouts.a.left, source.layouts.a.left);
  assert.equal(entry.profile.layouts.a.geometry.custom, 42);
  assert.equal(entry.profile.layouts.a.overlay.userId, undefined);
  assert.equal(entry.profile.layouts.a.overlay.bounds.right, 0);
  assert.deepEqual(source, before);
  assert.deepEqual(normalizeProfileLibrary({ t: entry }), { t: entry });
});

test("library validation rejects malformed and unsafe entries", () => {
  for (const value of [null, [], { t: {} }, { t: { name: "", profile: composition() } }, JSON.parse('{"__proto__":{}}')]) {
    assert.throws(() => normalizeProfileLibrary(value));
  }
  for (const name of ["", "  ", "a".repeat(121), null]) assert.throws(() => templateFromProfile(name, composition()));
  assert.throws(() => templateFromProfile("Name", { layouts: {} }), /profileEmpty/);
  assert.throws(() => templateFromProfile("Name", { layouts: { u: { overlay: [] } } }), /templateInvalid/);
  assert.throws(() => templateFromProfile("Name", composition(), -1), /templateInvalid/);
});

test("explicit mapping preserves relative references and unselected destination users", () => {
  const template = templateFromProfile("Shared", composition());
  const destination = { custom: 7, layouts: { keep: { transform: "custom" }, u: { width: "40px" } } };
  const users = [{ id: "u" }, { id: "v" }, { id: "keep" }];
  const next = profileWithTemplate(template, destination, { a: "u", b: "v" }, users);
  assert.deepEqual(templateUserIds(template), ["a", "b"]);
  assert.equal(next.layouts.v.relative.targetUserId, "u");
  assert.equal(next.layouts.u.width, undefined);
  assert.deepEqual(next.layouts.keep, destination.layouts.keep);
  assert.equal(next.custom, 7);
  assert.equal(next.enabled, true);
  assert.equal(next.cameraControlMode, "native");
  assert.equal(template.profile.layouts.b.relative.targetUserId, "a");
  assert.equal(destination.layouts.u.width, "40px");
  assert.throws(() => profileWithTemplate(template, destination, { a: "u", b: "u" }, users), /duplicateDestination/);
  assert.throws(() => profileWithTemplate(template, destination, { a: "", b: "v" }, users), /missingRelativeTarget/);
  assert.throws(() => profileWithTemplate(template, destination, { a: "missing", b: "v" }, users), /unknownReferences/);
  assert.throws(() => profileWithTemplate(template, destination, { a: "u" }, users), /unknownReferences/);
  assert.throws(() => profileWithTemplate(template, destination, { a: "", b: "" }, users), /profileEmpty/);
  assert.equal(profileWithTemplate(template, destination, { a: "u", b: "" }, users).layouts.v, undefined);
});

function environment(initial = {}) {
  const store = structuredClone(initial);
  const calls = [];
  globalThis.game = { user: { isGM: true }, settings: {
    get: (_module, key) => store[key] ?? {},
    set: async (_module, key, value) => { calls.push(key); store[key] = value; }
  } };
  return { store, calls };
}

test("library writes require GM, reject stale entries and preserve concurrent unrelated templates", async () => {
  const original = templateFromProfile("First", composition());
  const other = templateFromProfile("Other", composition());
  const { store, calls } = environment({ profileLibrary: { first: original, other } });
  game.user.isGM = false;
  assert.equal((await writeProfileTemplate("new", original)).reason, "permission");
  assert.equal(calls.length, 0);
  game.user.isGM = true;
  const updated = templateFromProfile("Renamed", composition(), 2);
  assert.equal((await writeProfileTemplate("first", updated, original)).ok, true);
  assert.deepEqual(store.profileLibrary.other, other);
  assert.equal((await writeProfileTemplate("first", null, original)).reason, "templateChanged");
  assert.equal((await writeProfileTemplate("first", null, updated)).ok, true);
  assert.equal(store.profileLibrary.first, undefined);
  assert.deepEqual(calls, ["profileLibrary", "profileLibrary"]);
});

test("library write failure reports recovery without publishing scene configuration", async () => {
  const { store } = environment({ sceneProfiles: { untouched: {} } });
  game.settings.set = async () => { throw new Error("offline"); };
  const result = await writeProfileTemplate("new", templateFromProfile("First", composition()));
  assert.equal(result.ok, false);
  assert.equal(result.recovery, "complete");
  assert.deepEqual(store, { sceneProfiles: { untouched: {} } });
});

test("post-write concurrent changes are not overwritten by recovery", async () => {
  const { store } = environment();
  game.settings.set = async (_module, key) => { store[key] = { external: templateFromProfile("Other GM", composition()) }; };
  const result = await writeProfileTemplate("new", templateFromProfile("First", composition()));
  assert.equal(result.ok, false);
  assert.equal(result.recovery, "incomplete");
  assert.equal(store.profileLibrary.external.name, "Other GM");
});
