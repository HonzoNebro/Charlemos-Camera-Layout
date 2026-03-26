import test from "node:test";
import assert from "node:assert/strict";
import { buildFormData, buildLayoutPatch, buildNameStylePatch } from "../../scripts/camera-config-model.js";

test("buildFormData maps stored layout to UI fields", () => {
  const formData = buildFormData({
    preset: "topLeft",
    snap: { enabled: true, size: 16 },
    resize: { aspectMode: "16:9" },
    position: "relative",
    top: "1rem",
    left: "2rem",
    width: "280px",
    height: "160px",
    relative: {
      targetUserId: "u2",
      placement: "below",
      gap: "12px"
    },
    crop: { top: "5%", right: "10px", bottom: "0", left: "2%" },
    transform: "rotate(3deg)",
    filter: "contrast(1.2)",
    clipPath: "circle(50%)",
    overlay: {
      enabled: true,
      imageUrl: "/a.png",
      opacity: 0.75,
      offset: { x: "20px", y: "-10%" },
      scale: 1.2,
      rotate: 15,
      fitMode: "contain",
      anchor: "top-right",
      tint: { enabled: true, color: "#112233", opacity: 0.35, blendMode: "multiply" }
    },
    nameStyle: {
      visible: false,
      source: "custom",
      text: "Ana",
      colorFromUser: true,
      color: "#00ff00",
      fontFamily: "Lora",
      position: "top",
      textAlign: "right",
      fontWeight: "700",
      fontStyle: "italic"
    },
    geometry: { borderRadius: "8px", skewX: 4, skewY: -2 }
  });

  assert.deepEqual(formData, {
    preset: "topLeft",
    snapEnabled: true,
    snapSize: 16,
    resizeAspect: "16:9",
    position: "relative",
    top: "1rem",
    left: "2rem",
    width: "280px",
    height: "160px",
    relativeTargetUserId: "u2",
    relativePlacement: "below",
    relativeGap: "12px",
    cropTop: "5%",
    cropRight: "10px",
    cropBottom: "0",
    cropLeft: "2%",
    transform: "rotate(3deg)",
    filter: "contrast(1.2)",
    clipPath: "circle(50%)",
    overlayEnabled: true,
    overlayImage: "/a.png",
    overlayOpacity: 0.75,
    overlayOffsetX: "20px",
    overlayOffsetY: "-10%",
    overlayScale: 1.2,
    overlayRotate: 15,
    overlayFitMode: "contain",
    overlayAnchor: "top-right",
    overlayTintEnabled: true,
    overlayTintColor: "#112233",
    overlayTintOpacity: 0.35,
    overlayTintBlendMode: "multiply",
    nameVisible: false,
    nameSource: "custom",
    nameText: "Ana",
    nameColorFromUser: true,
    nameColor: "#00ff00",
    nameFont: "Lora",
    namePosition: "top",
    nameTextAlign: "right",
    nameFontWeight: "700",
    nameFontStyle: "italic",
    geometryBorderRadius: "8px",
    geometrySkewX: 4,
    geometrySkewY: -2
  });
});

test("buildLayoutPatch normalizes empty form values", () => {
  const patch = buildLayoutPatch({
    position: "absolute",
    top: "10",
    left: "5%",
    width: "320",
    height: "180px",
    relativeTargetUserId: "u2",
    relativePlacement: "right-of",
    relativeGap: "24",
    cropTop: "",
    cropRight: "20",
    cropBottom: "5%",
    cropLeft: "0",
    transform: "",
    filter: "blur(1px)",
    clipPath: " circle(40%) ",
    overlayEnabled: true,
    overlayImage: "",
    overlayOpacity: "",
    overlayOffsetX: "12",
    overlayOffsetY: "-5%",
    overlayScale: "",
    overlayRotate: "",
    overlayFitMode: "fill",
    overlayAnchor: "bottom-left",
    overlayTintEnabled: true,
    overlayTintColor: "#ff0000",
    overlayTintOpacity: "0.5",
    overlayTintBlendMode: "screen",
    nameVisible: false,
    nameSource: "character",
    nameText: "",
    nameColorFromUser: true,
    nameColor: "#ffffff",
    nameFont: "",
    namePosition: "bottom",
    nameTextAlign: "left",
    nameFontWeight: "500",
    nameFontStyle: "italic",
    geometryBorderRadius: " 10px ",
    geometrySkewX: "",
    geometrySkewY: "-6"
  });

  assert.deepEqual(patch, {
    position: "absolute",
    top: "10px",
    left: "5%",
    width: "320px",
    height: "180px",
    relative: {
      targetUserId: "u2",
      placement: "right-of",
      gap: "24px"
    },
    crop: {
      top: null,
      right: "20px",
      bottom: "5%",
      left: "0px"
    },
    transform: null,
    filter: "blur(1px)",
    clipPath: "circle(40%)",
    overlay: {
      enabled: true,
      imageUrl: null,
      opacity: 1,
      offset: {
        x: "12px",
        y: "-5%"
      },
      scale: 1,
      rotate: 0,
      fitMode: "fill",
      anchor: "bottom-left",
      tint: {
        enabled: true,
        color: "#ff0000",
        opacity: 0.5,
        blendMode: "screen"
      }
    },
    nameStyle: {
      visible: false,
      source: "character",
      text: null,
      colorFromUser: true,
      color: "#ffffff",
      fontFamily: null,
      position: "bottom",
      textAlign: "left",
      fontWeight: "500",
      fontStyle: "italic"
    },
    geometry: {
      borderRadius: "10px"
    }
  });
});

test("buildLayoutPatch applies safe defaults for invalid name typography values", () => {
  const patch = buildLayoutPatch({
    cropTop: "",
    cropRight: "",
    cropBottom: "",
    cropLeft: "",
    transform: "",
    filter: "",
    clipPath: "",
    overlayEnabled: false,
    overlayImage: "",
    overlayOpacity: "",
    overlayOffsetX: "",
    overlayOffsetY: "",
    overlayScale: "",
    overlayRotate: "",
    overlayFitMode: "invalid-fit",
    overlayAnchor: "invalid-anchor",
    overlayTintEnabled: false,
    overlayTintColor: "",
    overlayTintOpacity: "",
    overlayTintBlendMode: "",
    nameVisible: true,
    nameSource: "user",
    nameText: "",
    nameColorFromUser: false,
    nameColor: "#ffffff",
    nameFont: "",
    namePosition: "sideways",
    nameTextAlign: "diagonal",
    nameFontWeight: "900",
    nameFontStyle: "slanted",
    geometryBorderRadius: ""
  });

  assert.deepEqual(
    {
      position: patch.nameStyle.position,
      align: patch.nameStyle.textAlign,
      weight: patch.nameStyle.fontWeight,
      style: patch.nameStyle.fontStyle,
      overlayFitMode: patch.overlay.fitMode,
      overlayAnchor: patch.overlay.anchor
    },
    {
      position: "sideways",
      align: "center",
      weight: "600",
      style: "normal",
      overlayFitMode: "auto",
      overlayAnchor: "center"
    }
  );
});

test("buildNameStylePatch only returns nameStyle payload", () => {
  const patch = buildNameStylePatch({
    nameVisible: true,
    nameSource: "user",
    nameText: "",
    nameColorFromUser: false,
    nameColor: "#ffffff",
    nameFont: "",
    namePosition: "top",
    nameTextAlign: "center",
    nameFontWeight: "600",
    nameFontStyle: "normal"
  });
  assert.deepEqual(Object.keys(patch), ["nameStyle"]);
  assert.equal(patch.nameStyle.position, "top");
  assert.equal(patch.nameStyle.textAlign, "center");
});
