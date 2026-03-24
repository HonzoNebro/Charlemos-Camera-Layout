import test from "node:test";
import assert from "node:assert/strict";
import { composeTransform, nameStyle, overlayStyle } from "../../scripts/camera-layout-style.js";

test("composeTransform appends geometry skew", () => {
  const transform = composeTransform("rotate(2deg)", { skewX: 5, skewY: -3 });
  assert.equal(transform, "rotate(2deg) skew(5deg, -3deg)");
});

test("composeTransform returns empty when no base transform and no skew", () => {
  const transform = composeTransform("", {});
  assert.equal(transform, "");
});

test("overlayStyle disabled hides overlay", () => {
  const style = overlayStyle({ overlay: { enabled: false, imageUrl: "/x.png", opacity: 0.5 } });
  assert.deepEqual(style, {
    display: "none",
    backgroundImage: "",
    backgroundBlendMode: "normal",
    mixBlendMode: "normal",
    opacity: "1",
    transform: "",
    transformOrigin: "center"
  });
});

test("overlayStyle applies transform and tint layer", () => {
  const style = overlayStyle({
    overlay: {
      enabled: true,
      imageUrl: "/x.png",
      opacity: 0.6,
      offset: { x: "10px", y: "-2%" },
      scale: 1.15,
      rotate: 12,
      tint: { enabled: true, color: "#123456", opacity: 0.4, blendMode: "multiply" }
    }
  });
  assert.equal(style.display, "block");
  assert.equal(style.backgroundImage, 'linear-gradient(rgba(18, 52, 86, 0.4), rgba(18, 52, 86, 0.4)), url("/x.png")');
  assert.equal(style.backgroundSize, "cover");
  assert.equal(style.backgroundBlendMode, "multiply");
  assert.equal(style.mixBlendMode, "normal");
  assert.equal(style.opacity, "0.6");
  assert.equal(style.transform, "translate(10px, -2%) scale(1.15) rotate(12deg)");
  assert.equal(style.transformOrigin, "center");
});

test("overlayStyle uses screen blend mode for frame overlays", () => {
  const style = overlayStyle({
    overlay: {
      enabled: true,
      imageUrl: "modules/falemos/assets/img/frames/elegant.png",
      opacity: 1
    }
  });
  assert.equal(style.backgroundSize, "100% 100%");
  assert.equal(style.mixBlendMode, "screen");
});

test("nameStyle resolves text and position", () => {
  const style = nameStyle(
    { nameStyle: { visible: true, source: "custom", text: "GM", color: "#ffffff", fontFamily: "Lora", position: "top" } },
    { userName: "Player A", characterName: "Char A", userColor: "#ff00ff", nowMs: 1000 }
  );
  assert.deepEqual(style, {
    display: "block",
    color: "#ffffff",
    fontFamily: "Lora",
    text: "GM",
    top: "0.25rem",
    bottom: ""
  });
});

test("nameStyle can use user color and alternate source", () => {
  const style = nameStyle(
    { nameStyle: { visible: true, source: "alternate", colorFromUser: true, color: "#ffffff", fontFamily: "", position: "bottom" } },
    { userName: "User", characterName: "Character", userColor: "#123456", nowMs: 0 }
  );
  assert.equal(style.color, "#123456");
  assert.equal(style.text, "User");
});
