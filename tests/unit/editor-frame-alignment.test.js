import test from "node:test";
import assert from "node:assert/strict";
import { EditSession } from "../../scripts/edit-session.js";
import { cameraSessionForAudience } from "../../scripts/role-variants.js";

globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
const { alignedFrameOffset, applyFrameAlignment } = await import("../../scripts/editor-frame-alignment.js");
const context = { width: 400, height: 200, viewportWidth: 1600, viewportHeight: 900 };

test("frame alignment includes asymmetric bounds, scale and rotation", () => {
  const overlay = { bounds: { mode: "expanded", left: 25, bottom: 50 }, scale: 2, rotate: 90 };
  assert.deepEqual(alignedFrameOffset(overlay, "left", context), { axis: "x", value: "150px" });
  assert.deepEqual(alignedFrameOffset(overlay, "right", context), { axis: "x", value: "-50px" });
  assert.deepEqual(alignedFrameOffset(overlay, "center", context), { axis: "x", value: "50px" });
  assert.deepEqual(alignedFrameOffset(overlay, "top", context), { axis: "y", value: "350px" });
  assert.deepEqual(alignedFrameOffset(overlay, "bottom", context), { axis: "y", value: "-450px" });
  assert.deepEqual(alignedFrameOffset(overlay, "middle", context), { axis: "y", value: "-50px" });
});

test("alignment preserves units using the expanded frame as percentage reference", () => {
  const bounds = { mode: "expanded", left: 25 };
  for (const [original, expected] of [["5%", "10%"], ["10vw", "3.125vw"], ["3vh", "5.556vh"], ["30px", "50px"]]) {
    assert.deepEqual(alignedFrameOffset({ bounds, offset: { x: original } }, "center", context), { axis: "x", value: expected });
  }
  assert.deepEqual(alignedFrameOffset({ bounds: { mode: "camera", left: 500 } }, "left", context), { axis: "x", value: "0px" });
});

test("alignment refuses unavailable dimensions and custom offsets without conversion", () => {
  for (const width of [0, undefined, Infinity, -1]) assert.equal(alignedFrameOffset({}, "center", { ...context, width }), null);
  assert.equal(alignedFrameOffset({ offset: { x: "calc(10% + 1px)" } }, "left", context), null);
  assert.equal(alignedFrameOffset({}, "unknown", context), null);
  assert.equal(alignedFrameOffset({ scale: NaN }, "left", context), null);
  assert.equal(alignedFrameOffset({ offset: { x: "1vw" } }, "left", { width: 400, height: 200 }), null);
});

test("alignment changes one role field, preserves video geometry and supports undo", () => {
  const session = new EditSession("scene", { profile: { enabled: true, layouts: { u: { width: "40vw", transform: "scale(2)", overlay: { bounds: { mode: "expanded", left: 25 }, offset: { x: "3%", y: "calc(4% + 1px)" }, rotate: 20 } } } } });
  const before = structuredClone(session.draft);
  assert.equal(applyFrameAlignment(cameraSessionForAudience(session, "player"), "u", "center", context), true);
  assert.deepEqual(session.draft.profile.layouts, before.profile.layouts);
  assert.deepEqual(session.draft.profile.roleVariants.player.layouts.u, { overlay: { offset: { x: "10%" } } });
  assert.equal(session.history.length, 1);
  assert.equal(session.preview, true);
  session.undo();
  assert.deepEqual(session.draft, before);
  session.busy = true;
  assert.equal(applyFrameAlignment(session, "u", "left", context), false);
  assert.deepEqual(session.draft, before);
});
