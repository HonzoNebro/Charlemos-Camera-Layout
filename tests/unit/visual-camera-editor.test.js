import test from "node:test";
import assert from "node:assert/strict";
import { EditSession } from "../../scripts/edit-session.js";

globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
const { VisualCameraEditor, lengthPixels, pixelsLength, snapCoordinate } = await import("../../scripts/visual-camera-editor.js");

class Element extends EventTarget {
  constructor(doc) {
    super(); this.ownerDocument = doc; this.children = []; this.dataset = {}; this.style = {}; this.isConnected = true;
    this.classList = { contains: (name) => name === "popout" };
  }
  appendChild(node) { this.children.push(node); node.parent = this; }
  setAttribute() {}
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter((item) => item !== this); }
  querySelector(selector) {
    if (selector.includes("data-guide")) return this.children.find((child) => child.dataset.guide === /"(.*?)"/.exec(selector)?.[1]) ?? null;
    return null;
  }
  closest() { return null; }
  getBoundingClientRect() { return { left: 20, top: 30, width: 200, height: 100, right: 220, bottom: 130 }; }
  getClientRects() { return [this.getBoundingClientRect()]; }
  setPointerCapture(id) { this.pointer = id; }
  hasPointerCapture(id) { return this.pointer === id; }
  releasePointerCapture() { this.pointer = null; }
}

function environment() {
  let activeObservers = 0;
  const frames = new Map();
  const doc = new EventTarget();
  doc.defaultView = {
    innerWidth: 1000, innerHeight: 500,
    requestAnimationFrame: (callback) => { frames.set(1, callback); return 1; },
    cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: class {
      observe() { activeObservers++; }
      disconnect() { activeObservers--; }
    }
  };
  doc.createElement = () => new Element(doc);
  const view = new Element(doc);
  view.offsetLeft = 20; view.offsetTop = 30;
  doc.querySelectorAll = () => [view];
  globalThis.canvas = { scene: { id: "a" } };
  globalThis.game = { i18n: { localize: (key) => key } };
  globalThis.ui = { webrtc: { getUserCameraView: () => view, getUserVideoElement: () => { throw new Error("must not touch feed"); } } };
  const session = new EditSession("a", { profile: { enabled: true, cameraControlMode: "module", layouts: { u: { left: "2vw", top: "6vh", width: "20vw", height: "20vh" } } }, background: null });
  session.preview = true;
  const editor = new VisualCameraEditor({ session, onUpdate: () => {}, onCommit: () => {}, onProblem: () => {} });
  return { doc, view, session, editor, frames, observers: () => activeObservers };
}

test("length conversion preserves units and snap considers all rectangle edges", () => {
  const context = { width: 500, height: 300, viewportWidth: 1000, viewportHeight: 800 };
  assert.equal(lengthPixels("20%", "width", context), 100);
  assert.equal(pixelsLength(200, "10vw", "width", context), "20vw");
  assert.equal(lengthPixels("calc(10vw + 5px)", "width", context), null);
  assert.equal(snapCoordinate(197, 100, [300]).value, 200);
  assert.equal(snapCoordinate(150, 100, [300]).value, 150);
});

test("owned nodes and observers remain unique and are removed on teardown", () => {
  const { editor, view, doc, observers } = environment();
  for (let i = 0; i < 10; i++) editor.reconcile("u");
  assert.equal(view.children.length, 1);
  assert.equal(view.children[0].ownerDocument, doc);
  assert.equal(view.children[0].dataset.charlemosAnchorUserId, "u");
  assert.equal(view.children[0].dataset.charlemosSceneId, "a");
  assert.equal(observers(), 1);
  editor.destroy();
  assert.equal(view.children.length, 0);
  assert.equal(observers(), 0);
});

test("camera gestures are grouped, preserve vw/vh and Escape restores the draft", () => {
  const { editor, view, session, frames } = environment();
  editor.snap = false;
  editor.reconcile("u");
  const handle = view.children[0].children[0];
  editor.start({ button: 0, clientX: 20, clientY: 30, pointerId: 1, currentTarget: handle, preventDefault() {}, stopPropagation() {} }, "move");
  editor.move({ clientX: 120, clientY: 80, preventDefault() {}, stopPropagation() {} });
  frames.get(1)();
  assert.equal(session.draft.profile.layouts.u.left, "12vw");
  assert.equal(session.draft.profile.layouts.u.top, "16vh");
  editor.finish(true);
  assert.equal(session.draft.profile.layouts.u.left, "2vw");
  assert.equal(session.history.length, 0);
  editor.destroy();
});

test("overlay gestures do not change video or camera geometry", () => {
  const { editor, view, session } = environment();
  editor.element = "overlay";
  editor.reconcile("u");
  const handle = view.children[0].children[0];
  editor.start({ button: 0, clientX: 0, clientY: 0, pointerId: 1, currentTarget: handle, preventDefault() {}, stopPropagation() {} }, "bounds-bottom");
  editor.pendingPoint = { x: 0, y: 25 };
  editor.finish(false);
  assert.equal(session.draft.profile.layouts.u.overlay.bounds.bottom, 25);
  assert.equal(session.draft.profile.layouts.u.width, "20vw");
  assert.equal(session.draft.profile.layouts.u.height, "20vh");
  assert.equal(session.history.length, 1);
  editor.destroy();
});

test("changing scene removes editing controls without discarding configuration", () => {
  const { editor, view, session, observers } = environment();
  editor.reconcile("u");
  canvas.scene.id = "b";
  editor.reconcile("u");
  assert.equal(view.children.length, 0);
  assert.equal(observers(), 0);
  assert.equal(session.draft.profile.layouts.u.width, "20vw");
});
