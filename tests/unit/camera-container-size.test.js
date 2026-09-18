import test from "node:test";
import assert from "node:assert/strict";
import { restoreCameraContainerSize, syncCameraContainerSize } from "../../scripts/camera-container-size.js";

function environment() {
  const native = { width: "0px", height: "auto" };
  const container = { style: { ...native }, clientWidth: 0, clientHeight: 0, querySelector: () => ({}) };
  const view = { clientWidth: 320, clientHeight: 180, querySelector: () => container };
  return { view, container, native };
}

test("collapsed module container receives a reversible size fallback without changing the view or video", () => {
  const { view, container, native } = environment();
  for (let index = 0; index < 20; index++) {
    syncCameraContainerSize(view, true);
    assert.deepEqual(container.style, { width: "100%", height: "100%" });
    assert.equal(view.clientWidth, 320);
    restoreCameraContainerSize(view);
    assert.deepEqual(container.style, native);
  }
});

test("fallback leaves healthy, native, hidden and minimized containers alone", () => {
  const { view, container, native } = environment();
  syncCameraContainerSize(view, false);
  assert.deepEqual(container.style, native);
  container.clientWidth = 320; container.clientHeight = 180;
  syncCameraContainerSize(view, true);
  assert.deepEqual(container.style, native);
  container.clientWidth = 0; container.clientHeight = 0;
  container.ownerDocument = { defaultView: { getComputedStyle: () => ({ display: "none" }) } };
  syncCameraContainerSize(view, true);
  assert.deepEqual(container.style, native);
  delete container.ownerDocument;
  view.clientWidth = 0;
  syncCameraContainerSize(view, true);
  assert.deepEqual(container.style, native);
});

test("fallback restores replaced containers and does not overwrite external inline changes", () => {
  const { view, container, native } = environment();
  syncCameraContainerSize(view, true);
  container.style.height = "75px";
  const replacement = { style: {}, clientWidth: 0, clientHeight: 100, querySelector: () => ({}) };
  view.querySelector = () => replacement;
  syncCameraContainerSize(view, true);
  assert.deepEqual(container.style, { width: native.width, height: "75px" });
  assert.equal(replacement.style.width, "100%");
  syncCameraContainerSize(view, false);
  assert.equal(replacement.style.width, "");
});
