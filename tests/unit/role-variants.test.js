import test from "node:test";
import assert from "node:assert/strict";
import { EditSession } from "../../scripts/edit-session.js";
import { normalizeRoleVariants, profileForAudience, cameraSessionForAudience, remapRoleVariants } from "../../scripts/role-variants.js";
globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
const { updateCameraField } = await import("../../scripts/editor-fields.js");

function profile() {
  return { enabled: true, cameraControlMode: "module", layouts: { u: { left: "10vw", width: "30vw", filter: "url(#custom)", overlay: { enabled: true, imageUrl: "art.png", bounds: { mode: "expanded", top: 10, bottom: 20 } } } }, roleVariants: {
    gm: { layouts: { u: { left: "50px", overlay: { bounds: { top: 30 } } } } },
    player: { cameraControlMode: "native", layouts: { u: { filter: null, overlay: { enabled: false, opacity: 0 } } } }
  } };
}

test("role variants merge only explicit fields and preserve false, zero and null", () => {
  const source = profile();
  const before = structuredClone(source);
  const gm = profileForAudience(source, "gm");
  assert.equal(gm.layouts.u.left, "50px");
  assert.equal(gm.layouts.u.width, "30vw");
  assert.deepEqual(gm.layouts.u.overlay.bounds, { mode: "expanded", top: 30, bottom: 20 });
  const player = profileForAudience(source, "player");
  assert.equal(player.cameraControlMode, "native");
  assert.equal(player.layouts.u.filter, null);
  assert.equal(player.layouts.u.overlay.enabled, false);
  assert.equal(player.layouts.u.overlay.opacity, 0);
  assert.equal(player.layouts.u.overlay.imageUrl, "art.png");
  assert.deepEqual(source, before);
  source.layouts.u.width = "40vw";
  assert.equal(profileForAudience(source, "gm").layouts.u.width, "40vw");
  assert.equal(profileForAudience(source, "base"), source);
});

test("normalization never materializes omitted role fields or legacy profiles", () => {
  const source = { gm: { layouts: { u: { overlay: { opacity: 0.5, bounds: { left: 14 }, userId: "wrong" } } } } };
  const next = normalizeRoleVariants(source);
  assert.deepEqual(next.gm.layouts.u.overlay, { opacity: 0.5, bounds: { left: 14 } });
  assert.equal(next.gm.cameraControlMode, undefined);
  assert.equal(next.player, undefined);
  const legacy = { layouts: { u: { left: "10px" } } };
  assert.equal(profileForAudience(legacy, "player"), legacy);
});

test("invalid role data is rejected at import but falls back safely during rendering", () => {
  for (const value of [null, [], { other: {} }, { gm: { enabled: false } }, { gm: { cameraControlMode: "invalid" } }, { gm: { layouts: { u: [] } } }, JSON.parse('{"gm":{"layouts":{"__proto__":{}}}}')]) {
    assert.throws(() => normalizeRoleVariants(value), /roleVariantsInvalid/);
  }
  const invalid = { layouts: { u: {} }, roleVariants: { other: {} } };
  assert.equal(profileForAudience(invalid, "gm"), invalid);
});

test("scoped form edits preserve base and other roles and share undo/redo", () => {
  const session = new EditSession("scene", { profile: profile(), background: { playerId: "u" } });
  const before = structuredClone(session.draft);
  const scoped = cameraSessionForAudience(session, "player");
  updateCameraField(scoped, "u", "overlayOpacity", "0.7");
  assert.equal(session.draft.profile.roleVariants.player.layouts.u.overlay.opacity, 0.7);
  assert.deepEqual(session.draft.profile.layouts, before.profile.layouts);
  assert.deepEqual(session.draft.profile.roleVariants.gm, before.profile.roleVariants.gm);
  assert.deepEqual(session.draft.background, before.background);
  assert.equal(session.history.length, 1);
  session.undo();
  assert.deepEqual(session.draft, before);
  session.redo();
  assert.equal(scoped.draft.profile.layouts.u.overlay.opacity, 0.7);
  scoped.edit(["profile", "layouts", "u", "overlay"], undefined);
  assert.equal(scoped.draft.profile.layouts.u.overlay.enabled, true);
});

test("visual gestures through scoped sessions write only role layout paths", () => {
  const session = new EditSession("scene", { profile: profile(), background: null });
  const scoped = cameraSessionForAudience(session, "gm");
  scoped.beginGesture();
  scoped.edit(["profile", "layouts", "u", "left"], "20px");
  scoped.edit(["profile", "layouts", "u", "left"], "30px");
  scoped.endGesture();
  assert.equal(session.history.length, 1);
  assert.equal(session.draft.profile.layouts.u.left, "10vw");
  assert.equal(session.draft.profile.roleVariants.gm.layouts.u.left, "30px");
  scoped.beginGesture();
  scoped.edit(["profile", "layouts", "u", "left"], "90px");
  scoped.endGesture(true);
  assert.equal(session.draft.profile.roleVariants.gm.layouts.u.left, "30px");
});

test("role remapping preserves omitted layout dictionaries and independent mode", () => {
  const mapped = remapRoleVariants({ gm: { cameraControlMode: "native" }, player: { layouts: { old: { filter: "blur(2px)" } } } }, (layouts) => ({ new: layouts.old }));
  assert.deepEqual(mapped.gm, { cameraControlMode: "native" });
  assert.equal(mapped.player.layouts.new.filter, "blur(2px)");
});
