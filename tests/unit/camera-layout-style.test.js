import test from "node:test";
import assert from "node:assert/strict";
import { composeTransform, nameStyle, overlayMediaKind, overlayMediaStyle, overlayStyle, overlayTintStyle } from "../../scripts/camera-layout-style.js";

test("explicit frame blending overrides legacy paths without altering tint or geometry", () => {
  for (const imageUrl of ["/frames/art.png", "/art.webm"]) {
    const overlay = { enabled: true, imageUrl, tint: { enabled: true, color: "#ffffff", opacity: 0.5, blendMode: "multiply" } };
    const legacy = overlayStyle({ overlay });
    for (const blendMode of ["normal", "screen", "soft-light"]) {
      const layout = { overlay: { ...overlay, blendMode } };
      assert.deepEqual(overlayStyle(layout), { ...legacy, mixBlendMode: blendMode });
      assert.equal(overlayTintStyle(layout).mixBlendMode, "multiply");
    }
    for (const blendMode of ["auto", "invalid", null]) {
      assert.deepEqual(overlayStyle({ overlay: { ...overlay, blendMode } }), legacy);
    }
  }
});

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
    inset: "0",
    overflow: "",
    backgroundImage: "",
    backgroundBlendMode: "normal",
    mixBlendMode: "normal",
    opacity: "1",
    transform: "",
    transformOrigin: "center",
    backgroundSize: "",
    backgroundPosition: "",
    backgroundRepeat: ""
  });
});

test("overlayStyle applies transform and keeps overlay container media-agnostic", () => {
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
  assert.equal(style.backgroundImage, "");
  assert.equal(style.backgroundSize, "");
  assert.equal(style.backgroundPosition, "");
  assert.equal(style.backgroundBlendMode, "normal");
  assert.equal(style.mixBlendMode, "normal");
  assert.equal(style.opacity, "0.6");
  assert.equal(style.transform, "translate(10px, -2%) scale(1.15) rotate(12deg)");
  assert.equal(style.transformOrigin, "center");
  assert.equal(style.inset, "0");
  assert.equal(style.overflow, "");
});

test("overlayStyle expands independently around the camera rectangle", () => {
  const style = overlayStyle({
    overlay: {
      enabled: true,
      imageUrl: "/x.png",
      offset: { x: "8px", y: "-4px" },
      scale: 1.1,
      rotate: 5,
      bounds: {
        mode: "expanded",
        top: 12.5,
        right: 25,
        bottom: 50.25,
        left: 5
      }
    }
  });

  assert.equal(style.inset, "-12.5% -25% -50.25% -5%");
  assert.equal(style.overflow, "visible");
  assert.equal(style.transform, "translate(8px, -4px) scale(1.1) rotate(5deg)");
});

test("overlayStyle uses screen blend mode for frame overlays", () => {
  const style = overlayStyle({
    overlay: {
      enabled: true,
      imageUrl: "modules/falemos/assets/img/frames/elegant.png",
      opacity: 1
    }
  });
  assert.equal(style.mixBlendMode, "screen");
});

test("overlayMediaStyle honors explicit fit mode and anchor", () => {
  const style = overlayMediaStyle({
    overlay: {
      enabled: true,
      imageUrl: "modules/falemos/assets/img/frames/elegant.png",
      fitMode: "contain",
      anchor: "bottom-right"
    }
  });
  assert.equal(style.objectFit, "contain");
  assert.equal(style.objectPosition, "right bottom");
});

test("overlayMediaKind detects video sources", () => {
  assert.equal(overlayMediaKind("/assets/overlay.webm"), "video");
  assert.equal(overlayMediaKind("/assets/overlay.png"), "image");
});

test("overlayTintStyle returns tint layer style", () => {
  const style = overlayTintStyle({
    overlay: {
      tint: {
        enabled: true,
        color: "#123456",
        opacity: 0.4,
        blendMode: "multiply"
      }
    }
  });
  assert.equal(style.display, "block");
  assert.equal(style.backgroundColor, "rgba(18, 52, 86, 0.4)");
  assert.equal(style.mixBlendMode, "multiply");
});

test("nameStyle resolves text and position", () => {
  const style = nameStyle(
    {
      nameStyle: {
        visible: true,
        source: "custom",
        text: "GM",
        color: "#ffffff",
        fontFamily: "Lora",
        fontSize: "1rem",
        lineHeight: "1.4",
        position: "top",
        offset: "12px",
        padding: {
          x: "1rem",
          y: "0.4rem"
        },
        background: {
          enabled: true,
          color: "#112233",
          opacity: 0.6
        },
        border: {
          enabled: true,
          color: "#445566",
          width: "2px",
          radius: "10px"
        },
        textAlign: "left",
        fontWeight: "500",
        fontStyle: "italic"
      }
    },
    { userName: "Player A", characterName: "Char A", userColor: "#ff00ff", nowMs: 1000 }
  );
  assert.deepEqual(style, {
    display: "block",
    color: "#ffffff",
    fontFamily: "Lora",
    fontSize: "1rem",
    lineHeight: "1.4",
    textAlign: "left",
    fontWeight: "500",
    fontStyle: "italic",
    padding: "0.4rem 1rem",
    background: "rgba(17, 34, 51, 0.6)",
    border: "2px solid #445566",
    borderTop: "",
    borderBottom: "",
    borderRadius: "10px",
    offset: "12px",
    text: "GM",
    position: "top"
  });
});

test("nameStyle can use user color and alternate source", () => {
  const style = nameStyle(
    {
      nameStyle: {
        visible: true,
        source: "alternate",
        colorFromUser: true,
        color: "#ffffff",
        fontFamily: "",
        position: "bottom",
        textAlign: "center",
        fontWeight: "600",
        fontStyle: "normal"
      }
    },
    { userName: "User", characterName: "Character", userColor: "#123456", nowMs: 0 }
  );
  assert.equal(style.color, "#123456");
  assert.equal(style.text, "User");
  assert.equal(style.background, "linear-gradient(to top, rgba(0, 0, 0, 0.86), rgba(0, 0, 0, 0.56), rgba(0, 0, 0, 0.2))");
  assert.equal(style.borderTop, "1px solid rgba(255, 255, 255, 0.08)");
});

test("nameStyle falls back to safe typography defaults", () => {
  const style = nameStyle(
    {
      nameStyle: {
        visible: true,
        source: "user",
        textAlign: "diagonal",
        fontWeight: "1000",
        fontStyle: "oblique"
      }
    },
    { userName: "Player" }
  );
  assert.equal(style.textAlign, "center");
  assert.equal(style.fontWeight, "600");
  assert.equal(style.fontStyle, "normal");
  assert.equal(style.position, "bottom");
  assert.equal(style.fontSize, "0.85rem");
  assert.equal(style.lineHeight, "1.2");
  assert.equal(style.padding, "0.3rem 0.5rem");
  assert.equal(style.offset, "0px");
});

test("nameStyle drops default edge border when using custom background without custom border", () => {
  const style = nameStyle(
    {
      nameStyle: {
        visible: true,
        source: "user",
        position: "bottom",
        background: {
          enabled: true,
          color: "#112233",
          opacity: 0
        },
        border: {
          enabled: false
        }
      }
    },
    { userName: "Player" }
  );

  assert.equal(style.background, "rgba(17, 34, 51, 0)");
  assert.equal(style.border, "");
  assert.equal(style.borderTop, "");
  assert.equal(style.borderBottom, "");
});
