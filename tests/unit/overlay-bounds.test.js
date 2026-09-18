import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_OVERLAY_BOUND_PERCENT,
  expandedOverlayBounds,
  normalizeOverlayBounds,
  normalizeOverlayConfiguration,
  overlayBoundsInset,
  visualOverflow
} from "../../scripts/overlay-bounds.js";

test("normalizeOverlayBounds supplies camera-compatible defaults", () => {
  assert.deepEqual(normalizeOverlayBounds(), {
    mode: "camera",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });
  assert.deepEqual(normalizeOverlayBounds({ mode: "outside" }), {
    mode: "camera",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });
});

test("normalizeOverlayBounds accepts decimals and clamps every outset", () => {
  assert.deepEqual(
    normalizeOverlayBounds({
      mode: " expanded ",
      top: "12.5",
      right: -10,
      bottom: 900,
      left: "12px"
    }),
    {
      mode: "expanded",
      top: 12.5,
      right: 0,
      bottom: MAX_OVERLAY_BOUND_PERCENT,
      left: 0
    }
  );
});

test("frame blend normalization preserves omitted legacy fields and restricts explicit values", () => {
  assert.equal(Object.hasOwn(normalizeOverlayConfiguration({}), "blendMode"), false);
  for (const mode of ["auto", "normal", "screen", "soft-light"]) {
    assert.equal(normalizeOverlayConfiguration({ blendMode: mode }).blendMode, mode);
  }
  for (const mode of [null, "multiply", "", {}, "screen; display:none"]) {
    assert.equal(normalizeOverlayConfiguration({ blendMode: mode }).blendMode, "auto");
  }
});

test("normalizeOverlayConfiguration preserves overlay fields and normalizes bounds", () => {
  const overlay = {
    enabled: true,
    imageUrl: "/frame.png",
    userId: "legacy-user",
    bounds: { mode: "expanded", top: 20, right: 30 }
  };

  const normalized = normalizeOverlayConfiguration(overlay);

  assert.notEqual(normalized, overlay);
  assert.deepEqual(normalized, {
    enabled: true,
    imageUrl: "/frame.png",
    bounds: {
      mode: "expanded",
      top: 20,
      right: 30,
      bottom: 0,
      left: 0
    }
  });
  assert.deepEqual(overlay.bounds, { mode: "expanded", top: 20, right: 30 });
  assert.equal(normalized.userId, undefined);
  assert.equal(normalizeOverlayConfiguration(null), null);
});

test("expandedOverlayBounds and overlayBoundsInset retain camera mode behavior", () => {
  assert.equal(expandedOverlayBounds({ mode: "camera", top: 25 }), null);
  assert.equal(overlayBoundsInset({ bounds: { mode: "camera", top: 25 } }), "0");
  assert.deepEqual(expandedOverlayBounds({ bounds: { mode: "expanded", top: 10, right: 20, bottom: 30, left: 40 } }), {
    mode: "expanded",
    top: 10,
    right: 20,
    bottom: 30,
    left: 40
  });
  assert.equal(
    overlayBoundsInset({ bounds: { mode: "expanded", top: 10, right: 20.5, bottom: 30, left: 40 } }),
    "-10% -20.5% -30% -40%"
  );
});

test("visualOverflow measures only the overlay area outside the camera", () => {
  const viewRect = { top: 100, right: 300, bottom: 300, left: 100 };

  assert.deepEqual(visualOverflow(viewRect, { top: 75, right: 340, bottom: 335, left: 80 }), {
    top: 25,
    right: 40,
    bottom: 35,
    left: 20
  });
  assert.deepEqual(visualOverflow(viewRect, { top: 125, right: 280, bottom: 275, left: 120 }), {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });
  assert.deepEqual(visualOverflow(null, null), { top: 0, right: 0, bottom: 0, left: 0 });
});
