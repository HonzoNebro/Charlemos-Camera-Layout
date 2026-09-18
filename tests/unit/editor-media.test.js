import test from "node:test";
import assert from "node:assert/strict";
import { inspectOverlayResource } from "../../scripts/editor-media.js";

function documentStub() {
  const elements = [];
  return { elements, createElement: (tag) => {
    const element = new EventTarget();
    element.tag = tag;
    element.removeAttribute = () => { element.cleared = true; };
    element.remove = () => { element.removed = true; };
    element.pause = element.load = () => { throw new Error("unexpected playback operation"); };
    elements.push(element);
    return element;
  } };
}

test("resource inspection cleans image listeners and responds to cancellation", async () => {
  const doc = documentStub();
  const controller = new AbortController();
  const pending = inspectOverlayResource(doc, "frame.png", { signal: controller.signal });
  controller.abort();
  assert.equal(await pending, "unavailable");
  assert.equal(doc.elements[0].removed, true);
  assert.equal(doc.elements[0].cleared, true);
});

test("WebM validation loads metadata without playing, pausing or reloading", async () => {
  const doc = documentStub();
  const pending = inspectOverlayResource(doc, "frame.webm");
  assert.equal(doc.elements[0].tag, "video");
  assert.equal(doc.elements[0].preload, "metadata");
  doc.elements[0].dispatchEvent(new Event("loadedmetadata"));
  assert.equal(await pending, "available");
  assert.equal(doc.elements[0].removed, true);
});
