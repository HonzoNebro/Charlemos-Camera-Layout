import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  anchoredOverlaySnapshot,
  calculateOverlayDockSpacing,
  cleanupAnchoredOverlays,
  clearAnchoredOverlays,
  reconcileAnchoredOverlay,
  removeAnchoredOverlay
} from "../../scripts/overlay-runtime.js";

const originalResizeObserver = globalThis.ResizeObserver;
let observerInstances;

class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = new Set();
    this.observeCalls = 0;
    this.unobserveCalls = 0;
    this.disconnectCalls = 0;
    observerInstances.push(this);
  }

  observe(target) {
    this.observeCalls += 1;
    this.targets.add(target);
  }

  unobserve(target) {
    this.unobserveCalls += 1;
    this.targets.delete(target);
  }

  disconnect() {
    this.disconnectCalls += 1;
    this.targets.clear();
  }

  resize(target) {
    this.callback([{ target }]);
  }
}

function classList() {
  const values = new Set();
  return {
    values,
    contains: (name) => values.has(name),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    toggle(name, force) {
      if (force) values.add(name);
      else values.delete(name);
      return force;
    }
  };
}

function element(rect, options = {}) {
  const style = {
    marginTop: options.marginTop ?? "",
    marginRight: options.marginRight ?? "",
    marginBottom: options.marginBottom ?? "",
    marginLeft: options.marginLeft ?? "",
    flexShrink: options.flexShrink ?? ""
  };
  const computedMargins = options.computedMargins ?? {};
  const node = {
    style,
    classList: classList(),
    isConnected: options.isConnected ?? true,
    removed: 0,
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({
          marginTop: computedMargins.top ?? "0px",
          marginRight: computedMargins.right ?? "0px",
          marginBottom: computedMargins.bottom ?? "0px",
          marginLeft: computedMargins.left ?? "0px"
        })
      }
    },
    getBoundingClientRect: () => ({ ...rect }),
    setRect(nextRect) {
      rect = { ...nextRect };
    },
    remove() {
      this.removed += 1;
    }
  };
  return node;
}

beforeEach(() => {
  clearAnchoredOverlays();
  observerInstances = [];
  globalThis.ResizeObserver = FakeResizeObserver;
});

afterEach(() => {
  clearAnchoredOverlays();
  if (originalResizeObserver === undefined) delete globalThis.ResizeObserver;
  else globalThis.ResizeObserver = originalResizeObserver;
});

test("calculateOverlayDockSpacing delegates visual overflow geometry", () => {
  assert.deepEqual(
    calculateOverlayDockSpacing(
      { top: 100, right: 300, bottom: 300, left: 100 },
      { top: 80, right: 325, bottom: 340, left: 70 }
    ),
    { top: 20, right: 25, bottom: 40, left: 30 }
  );
});

test("repeated dock, popout and scene replacement restores native spacing and observers", () => {
  for (let cycle = 0; cycle < 40; cycle++) {
    const view = element({ top: 100, right: 300, bottom: 300, left: 100 }, { marginLeft: "auto", flexShrink: "1" });
    const original = { ...view.style };
    const overlay = element({ top: 60, right: 350, bottom: 330, left: 80 });
    const options = { sceneId: `s${cycle}`, userId: "u", viewElement: view, overlayElement: overlay, expanded: true, popout: false };
    reconcileAnchoredOverlay(options);
    reconcileAnchoredOverlay(options);
    assert.equal(observerInstances.length, 1);
    assert.equal(observerInstances[0].targets.size, 1);
    reconcileAnchoredOverlay({ ...options, popout: true });
    assert.deepEqual(view.style, original);
    assert.equal(observerInstances[0].targets.size, 0);
    reconcileAnchoredOverlay(options);
    removeAnchoredOverlay(options.sceneId, options.userId);
    assert.deepEqual(view.style, original);
    assert.equal(observerInstances[0].targets.size, 0);
    assert.equal(anchoredOverlaySnapshot(options.sceneId, options.userId), null);
  }
});

test("reconcileAnchoredOverlay associates scene and user and reserves dock space", () => {
  const view = element(
    { top: 100, right: 300, bottom: 300, left: 100 },
    {
      marginTop: "var(--native-top)",
      marginRight: "",
      marginBottom: "4px",
      marginLeft: "auto",
      flexShrink: "1",
      computedMargins: { top: "4px", right: "5px", bottom: "6px", left: "7px" }
    }
  );
  const overlay = element({ top: 80, right: 325, bottom: 340, left: 70 });

  const key = reconcileAnchoredOverlay({
    sceneId: "scene-a",
    userId: "user-a",
    viewElement: view,
    overlayElement: overlay,
    expanded: true,
    popout: false
  });

  assert.equal(key, "scene-a:user-a");
  assert.equal(view.classList.contains("charlemos-overlay-expanded"), true);
  assert.equal(view.classList.contains("charlemos-overlay-dock-spaced"), true);
  assert.deepEqual(view.style, {
    marginTop: "24px",
    marginRight: "30px",
    marginBottom: "46px",
    marginLeft: "37px",
    flexShrink: "0"
  });
  assert.deepEqual(anchoredOverlaySnapshot("scene-a", "user-a"), {
    sceneId: "scene-a",
    userId: "user-a",
    expanded: true,
    popout: false,
    spacing: { top: 20, right: 25, bottom: 40, left: 30 },
    viewRect: { top: 100, right: 300, bottom: 300, left: 100 },
    overlayRect: { top: 80, right: 325, bottom: 340, left: 70 }
  });
  assert.equal(observerInstances.length, 1);
  assert.deepEqual([...observerInstances[0].targets], [view]);

  overlay.setRect({ top: 90, right: 310, bottom: 315, left: 95 });
  observerInstances[0].resize(view);
  assert.deepEqual(view.style, {
    marginTop: "14px",
    marginRight: "15px",
    marginBottom: "21px",
    marginLeft: "12px",
    flexShrink: "0"
  });
  assert.deepEqual(anchoredOverlaySnapshot("scene-a", "user-a")?.spacing, {
    top: 10,
    right: 10,
    bottom: 15,
    left: 5
  });
});

test("reconciling the same camera is idempotent and does not compound margins", () => {
  const view = element(
    { top: 10, right: 110, bottom: 110, left: 10 },
    { computedMargins: { top: "2px", right: "3px", bottom: "4px", left: "5px" } }
  );
  const overlay = element({ top: 0, right: 130, bottom: 140, left: -30 });
  const options = {
    sceneId: "scene-a",
    userId: "user-a",
    viewElement: view,
    overlayElement: overlay,
    expanded: true,
    popout: false
  };

  reconcileAnchoredOverlay(options);
  const firstStyle = { ...view.style };
  reconcileAnchoredOverlay(options);

  assert.deepEqual(view.style, firstStyle);
  assert.equal(overlay.removed, 0);
  assert.equal(observerInstances.length, 1);
  assert.equal(observerInstances[0].targets.size, 1);
  assert.equal(observerInstances[0].targets.has(view), true);
});

test("reconciling a replaced overlay node releases the old node without disposing its camera", () => {
  const view = element({ top: 0, right: 100, bottom: 100, left: 0 });
  const firstOverlay = element({ top: -10, right: 110, bottom: 110, left: -10 });
  const secondOverlay = element({ top: -20, right: 120, bottom: 120, left: -20 });
  let disposeCount = 0;
  const base = {
    sceneId: "scene-a",
    userId: "user-a",
    viewElement: view,
    expanded: true,
    popout: false,
    onDispose: () => {
      disposeCount += 1;
    }
  };

  reconcileAnchoredOverlay({ ...base, overlayElement: firstOverlay });
  reconcileAnchoredOverlay({ ...base, overlayElement: secondOverlay });

  assert.equal(firstOverlay.removed, 1);
  assert.equal(secondOverlay.removed, 0);
  assert.equal(disposeCount, 0);
  assert.equal(anchoredOverlaySnapshot("scene-a", "user-a")?.overlayRect.left, -20);
});

test("replacing a camera view removes the old overlay and restores native styles", () => {
  const firstView = element(
    { top: 0, right: 100, bottom: 100, left: 0 },
    {
      marginTop: "1em",
      marginRight: "2em",
      marginBottom: "3em",
      marginLeft: "4em",
      flexShrink: "2",
      computedMargins: { top: "1px", right: "2px", bottom: "3px", left: "4px" }
    }
  );
  const firstOverlay = element({ top: -10, right: 110, bottom: 110, left: -10 });
  const secondView = element({ top: 200, right: 300, bottom: 300, left: 200 });
  const secondOverlay = element({ top: 180, right: 320, bottom: 320, left: 180 });
  let firstDisposeCount = 0;

  reconcileAnchoredOverlay({
    sceneId: "scene-a",
    userId: "user-a",
    viewElement: firstView,
    overlayElement: firstOverlay,
    expanded: true,
    popout: false,
    onDispose: () => {
      firstDisposeCount += 1;
    }
  });
  reconcileAnchoredOverlay({
    sceneId: "scene-a",
    userId: "user-a",
    viewElement: secondView,
    overlayElement: secondOverlay,
    expanded: true,
    popout: false
  });

  assert.equal(firstOverlay.removed, 1);
  assert.equal(firstDisposeCount, 1);
  assert.deepEqual(firstView.style, {
    marginTop: "1em",
    marginRight: "2em",
    marginBottom: "3em",
    marginLeft: "4em",
    flexShrink: "2"
  });
  assert.equal(firstView.classList.contains("charlemos-overlay-expanded"), false);
  assert.equal(observerInstances[0].targets.has(firstView), false);
  assert.equal(observerInstances[0].targets.has(secondView), true);
  assert.deepEqual(anchoredOverlaySnapshot("scene-a", "user-a")?.viewRect, {
    top: 200,
    right: 300,
    bottom: 300,
    left: 200
  });
});

test("scene changes and cleanup preserve only active scene-user keys", () => {
  const oldView = element({ top: 0, right: 100, bottom: 100, left: 0 });
  const oldOverlay = element({ top: -10, right: 110, bottom: 110, left: -10 });
  const currentView = element({ top: 0, right: 100, bottom: 100, left: 0 });
  const currentOverlay = element({ top: -20, right: 120, bottom: 120, left: -20 });
  const otherView = element({ top: 0, right: 100, bottom: 100, left: 0 });
  const otherOverlay = element({ top: -5, right: 105, bottom: 105, left: -5 });

  reconcileAnchoredOverlay({
    sceneId: "scene-old",
    userId: "user-a",
    viewElement: oldView,
    overlayElement: oldOverlay,
    expanded: true,
    popout: false
  });
  reconcileAnchoredOverlay({
    sceneId: "scene-current",
    userId: "user-a",
    viewElement: currentView,
    overlayElement: currentOverlay,
    expanded: true,
    popout: false
  });
  reconcileAnchoredOverlay({
    sceneId: "scene-current",
    userId: "user-b",
    viewElement: otherView,
    overlayElement: otherOverlay,
    expanded: true,
    popout: false
  });

  assert.equal(oldOverlay.removed, 1);
  assert.equal(anchoredOverlaySnapshot("scene-old", "user-a"), null);
  cleanupAnchoredOverlays(new Set(["scene-current:user-a"]));
  assert.notEqual(anchoredOverlaySnapshot("scene-current", "user-a"), null);
  assert.equal(anchoredOverlaySnapshot("scene-current", "user-b"), null);
  assert.equal(otherOverlay.removed, 1);
  assert.equal(removeAnchoredOverlay("scene-current", "user-a"), true);
  assert.equal(removeAnchoredOverlay("scene-current", "user-a"), false);
  assert.equal(currentOverlay.removed, 1);
});

test("scene changes reuse the same camera DOM without disposing the newly applied overlay", () => {
  const view = element({ top: 0, right: 100, bottom: 100, left: 0 });
  const overlay = element({ top: -10, right: 110, bottom: 110, left: -10 });
  let oldDisposeCount = 0;

  reconcileAnchoredOverlay({
    sceneId: "scene-old",
    userId: "user-a",
    viewElement: view,
    overlayElement: overlay,
    expanded: true,
    popout: false,
    onDispose: () => {
      oldDisposeCount += 1;
    }
  });
  reconcileAnchoredOverlay({
    sceneId: "scene-new",
    userId: "user-a",
    viewElement: view,
    overlayElement: overlay,
    expanded: true,
    popout: false
  });

  assert.equal(oldDisposeCount, 0);
  assert.equal(overlay.removed, 0);
  assert.equal(anchoredOverlaySnapshot("scene-old", "user-a"), null);
  assert.equal(anchoredOverlaySnapshot("scene-new", "user-a")?.viewRect.left, 0);
});

test("popouts do not reserve dock margins and clear disconnects observers", () => {
  const dockView = element(
    { top: 0, right: 100, bottom: 100, left: 0 },
    { marginTop: "3px", flexShrink: "1" }
  );
  const dockOverlay = element({ top: -10, right: 110, bottom: 110, left: -10 });

  reconcileAnchoredOverlay({
    sceneId: "scene-a",
    userId: "dock-user",
    viewElement: dockView,
    overlayElement: dockOverlay,
    expanded: true,
    popout: false
  });
  const firstObserver = observerInstances[0];
  clearAnchoredOverlays();

  assert.equal(firstObserver.disconnectCalls, 1);
  assert.equal(firstObserver.targets.size, 0);
  assert.equal(dockOverlay.removed, 1);
  assert.equal(dockView.style.marginTop, "3px");
  assert.equal(dockView.style.flexShrink, "1");

  const popoutView = element(
    { top: 0, right: 100, bottom: 100, left: 0 },
    { marginTop: "8px", flexShrink: "2" }
  );
  const popoutOverlay = element({ top: -50, right: 150, bottom: 150, left: -50 });
  reconcileAnchoredOverlay({
    sceneId: "scene-a",
    userId: "popout-user",
    viewElement: popoutView,
    overlayElement: popoutOverlay,
    expanded: true,
    popout: true
  });

  assert.equal(observerInstances.length, 1);
  assert.equal(popoutView.style.marginTop, "8px");
  assert.equal(popoutView.style.flexShrink, "2");
  assert.equal(popoutView.classList.contains("charlemos-overlay-expanded"), true);
  assert.equal(popoutView.classList.contains("charlemos-overlay-dock-spaced"), false);

  const newDockView = element({ top: 0, right: 100, bottom: 100, left: 0 });
  const newDockOverlay = element({ top: -5, right: 105, bottom: 105, left: -5 });
  reconcileAnchoredOverlay({
    sceneId: "scene-a",
    userId: "new-dock-user",
    viewElement: newDockView,
    overlayElement: newDockOverlay,
    expanded: true,
    popout: false
  });
  assert.equal(observerInstances.length, 2);
  assert.equal(observerInstances[1].targets.size, 1);
  assert.equal(observerInstances[1].targets.has(newDockView), true);
});

test("cleanup releases only owned overlay video resources", () => {
  let overlayPause = 0;
  let overlayLoad = 0;
  let overlaySourceRemoved = 0;
  let cameraPause = 0;
  let cameraLoad = 0;
  const cameraVideo = {
    pause: () => {
      cameraPause += 1;
    },
    load: () => {
      cameraLoad += 1;
    }
  };
  const overlayVideo = {
    pause: () => {
      overlayPause += 1;
    },
    load: () => {
      overlayLoad += 1;
    },
    removeAttribute: (name) => {
      if (name === "src") overlaySourceRemoved += 1;
    }
  };
  const view = element({ top: 0, right: 100, bottom: 100, left: 0 });
  view.querySelector = (selector) => selector === "video" ? cameraVideo : null;
  const overlay = element({ top: 0, right: 100, bottom: 100, left: 0 });
  overlay.querySelector = (selector) => selector === ".charlemos-camera-overlay-video" ? overlayVideo : null;

  reconcileAnchoredOverlay({
    sceneId: "scene-a",
    userId: "user-a",
    viewElement: view,
    overlayElement: overlay,
    expanded: false,
    popout: false
  });
  clearAnchoredOverlays();

  assert.equal(overlayPause, 1);
  assert.equal(overlayLoad, 1);
  assert.equal(overlaySourceRemoved, 1);
  assert.equal(cameraPause, 0);
  assert.equal(cameraLoad, 0);
});
