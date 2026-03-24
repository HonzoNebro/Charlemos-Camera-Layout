import test from "node:test";
import assert from "node:assert/strict";
import { buildVideoStyle } from "../../scripts/camera-style-service.js";

test("buildVideoStyle returns only supported style keys", () => {
  const result = buildVideoStyle({
    position: "absolute",
    top: "10px",
    left: "20px",
    width: "320px",
    height: "180px",
    transform: "rotate(2deg)",
    filter: "grayscale(0.3)",
    clipPath: "circle(45%)",
    overlay: "ignored"
  });

  assert.deepEqual(result, {
    position: "absolute",
    top: "10px",
    left: "20px",
    width: "320px",
    height: "180px",
    transform: "rotate(2deg)",
    filter: "grayscale(0.3)",
    clipPath: "circle(45%)"
  });
});
