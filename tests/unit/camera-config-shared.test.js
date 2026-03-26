import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeLayoutForCameraControlMode, sanitizeLayouts } from "../../scripts/camera-config-shared.js";

test("sanitizeLayoutForCameraControlMode strips geometry ownership fields in native mode", () => {
  const result = sanitizeLayoutForCameraControlMode(
    {
      position: "absolute",
      top: "10px",
      left: "20px",
      width: "320px",
      height: "180px",
      relative: {
        targetUserId: "u2",
        placement: "below",
        gap: "12px"
      },
      filter: "blur(1px)",
      crop: { top: "5px" }
    },
    "native"
  );

  assert.deepEqual(result, {
    filter: "blur(1px)",
    crop: { top: "5px" }
  });
});

test("sanitizeLayouts preserves geometry ownership fields in module mode", () => {
  const result = sanitizeLayouts(
    {
      u1: {
        position: "absolute",
        top: "10px",
        left: "20px",
        width: "320px",
        height: "180px",
        relative: {
          targetUserId: "u2",
          placement: "below",
          gap: "12px"
        },
        filter: "blur(1px)"
      }
    },
    "module"
  );

  assert.deepEqual(result, {
    u1: {
      position: "absolute",
      top: "10px",
      left: "20px",
      width: "320px",
      height: "180px",
      relative: {
        targetUserId: "u2",
        placement: "below",
        gap: "12px"
      },
      filter: "blur(1px)"
    }
  });
});
