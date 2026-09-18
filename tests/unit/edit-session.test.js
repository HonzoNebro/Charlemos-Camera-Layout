import test from "node:test";
import assert from "node:assert/strict";
import { EditSession, configurationChanges, setConfigurationValue, writeConfigurationBlocks } from "../../scripts/edit-session.js";

test("edits distinguish deletion, null and untouched fields without mutating the source", () => {
  const initial = { layouts: { u: { width: "30vw", overlay: { enabled: true, custom: 42 } } } };
  const session = new EditSession("a", initial);
  session.edit(["layouts", "u", "overlay", "enabled"], false);
  session.edit(["layouts", "u", "width"], null);
  assert.equal(initial.layouts.u.overlay.enabled, true);
  assert.equal(session.draft.layouts.u.overlay.custom, 42);
  assert.equal(session.changes.length, 2);
  session.edit(["layouts", "u", "width"], undefined);
  assert.equal(Object.hasOwn(session.draft.layouts.u, "width"), false);
  assert.throws(() => setConfigurationValue({}, ["__proto__", "polluted"], true));
});

test("external changes merge untouched fields and overlapping fields need explicit resolution", () => {
  const session = new EditSession("a", { width: "100px", filter: "none" });
  session.edit(["width"], "200px");
  session.reconcile({ width: "100px", filter: "blur(1px)" });
  assert.deepEqual(session.draft, { width: "200px", filter: "blur(1px)" });
  assert.equal(session.conflicts.length, 0);
  session.reconcile({ width: "300px", filter: "blur(1px)" });
  assert.equal(session.conflicts.length, 1);
  session.reconcile({ width: "300px", filter: "blur(2px)" });
  assert.equal(session.conflicts.length, 1);
  session.resolve(["width"], false);
  assert.equal(session.draft.width, "300px");
  assert.equal(session.dirty, false);
});

test("gestures have one undo step, cancellation restores draft and history is bounded", () => {
  const session = new EditSession("a", { x: 0 });
  session.beginGesture();
  for (let x = 1; x <= 200; x++) session.edit(["x"], x);
  session.endGesture();
  assert.equal(session.history.length, 1);
  session.undo();
  assert.equal(session.draft.x, 0);
  session.redo();
  assert.equal(session.draft.x, 200);
  session.beginGesture();
  session.edit(["x"], 500);
  session.endGesture(true);
  assert.equal(session.draft.x, 200);
  for (let x = 1; x <= 150; x++) session.edit(["x"], x);
  assert.equal(session.history.length, 100);
  session.accept(session.draft);
  assert.equal(session.dirty, false);
  assert.equal(session.history.length, 0);
});

test("comparison is independent of object key order", () => {
  assert.deepEqual(configurationChanges({ a: 1, b: 2 }, { b: 2, a: 1 }), []);
});

test("failed multi-block write restores only its own changes", async () => {
  const store = { a: { value: 1 }, b: { value: 2 } };
  const result = await writeConfigurationBlocks([
    { key: "a", before: { value: 1 }, after: { value: 3 } },
    { key: "b", before: { value: 2 }, after: { value: 4 } }
  ], {
    read: (key) => store[key],
    write: async (key, value) => {
      if (key === "b") throw new Error("failure");
      store[key] = value;
    }
  });
  assert.equal(result.ok, false);
  assert.equal(result.recovery, "complete");
  assert.deepEqual(store, { a: { value: 1 }, b: { value: 2 } });
});

test("rollback never overwrites an external update", async () => {
  const store = { a: 1, b: 2 };
  const result = await writeConfigurationBlocks([
    { key: "a", before: 1, after: 3 },
    { key: "b", before: 2, after: 4 }
  ], {
    read: (key) => store[key],
    write: async (key, value) => {
      if (key === "b") {
        store.a = 10;
        throw new Error("failure");
      }
      store[key] = value;
    }
  });
  assert.equal(result.recovery, "incomplete");
  assert.equal(store.a, 10);
});
