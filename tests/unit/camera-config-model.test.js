import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFormData,
  buildLayoutPatch,
  buildNameStylePatch,
  inferLayoutMode,
  normalizedLayoutMode,
  validateLayoutFormData
} from "../../scripts/camera-config-model.js";

test("buildFormData maps stored layout to UI fields", () => {
  const formData = buildFormData({
    layoutMode: "relative",
    position: "absolute",
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
        opacity: 0.65
      },
      border: {
        enabled: true,
        color: "#445566",
        width: "2px",
        radius: "14px"
      },
      textAlign: "right",
      fontWeight: "700",
      fontStyle: "italic"
    },
    geometry: { borderRadius: "8px", transparentFrame: true, skewX: 4, skewY: -2 }
  });

  assert.deepEqual(formData, {
    layoutMode: "relative",
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
    nameFontSize: "1rem",
    nameLineHeight: "1.4",
    namePosition: "top",
    nameOffset: "12px",
    namePaddingX: "1rem",
    namePaddingY: "0.4rem",
    nameCustomBackground: true,
    nameBackgroundColor: "#112233",
    nameBackgroundOpacity: 0.65,
    nameCustomBorder: true,
    nameBorderColor: "#445566",
    nameBorderWidth: "2px",
    nameBorderRadius: "14px",
    nameTextAlign: "right",
    nameFontWeight: "700",
    nameFontStyle: "italic",
    geometryBorderRadius: "8px",
    geometryTransparentFrame: true,
    geometrySkewX: 4,
    geometrySkewY: -2
  });
});

test("buildLayoutPatch normalizes empty form values", () => {
  const patch = buildLayoutPatch({
    layoutMode: "relative",
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
    nameFontSize: "16",
    nameLineHeight: "1.5",
    namePosition: "bottom",
    nameOffset: "8",
    namePaddingX: "12",
    namePaddingY: "6",
    nameCustomBackground: true,
    nameBackgroundColor: "#112233",
    nameBackgroundOpacity: "0.4",
    nameCustomBorder: true,
    nameBorderColor: "#334455",
    nameBorderWidth: "2",
    nameBorderRadius: "10",
    nameTextAlign: "left",
    nameFontWeight: "500",
    nameFontStyle: "italic",
    geometryBorderRadius: " 10px ",
    geometryTransparentFrame: true,
    geometrySkewX: "",
    geometrySkewY: "-6"
  });

  assert.deepEqual(patch, {
    layoutMode: "relative",
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
      fontSize: "16px",
      lineHeight: "1.5",
      position: "bottom",
      offset: "8px",
      padding: {
        x: "12px",
        y: "6px"
      },
      background: {
        enabled: true,
        color: "#112233",
        opacity: 0.4
      },
      border: {
        enabled: true,
        color: "#334455",
        width: "2px",
        radius: "10px"
      },
      textAlign: "left",
      fontWeight: "500",
      fontStyle: "italic"
    },
    geometry: {
      borderRadius: "10px",
      transparentFrame: true
    }
  });
});

test("buildLayoutPatch clears relative payload when layout mode is absolute", () => {
  const patch = buildLayoutPatch({
    layoutMode: "absolute",
    top: "10",
    left: "20",
    width: "",
    height: "",
    relativeTargetUserId: "u2",
    relativePlacement: "below-center",
    relativeGap: "12",
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
    overlayFitMode: "",
    overlayAnchor: "",
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
    namePosition: "bottom",
    nameTextAlign: "center",
    nameFontWeight: "600",
    nameFontStyle: "normal",
    geometryBorderRadius: ""
  });

  assert.deepEqual(patch.relative, {
    targetUserId: null,
    placement: "none",
    gap: null
  });
});

test("buildLayoutPatch normalizes border radius numbers as px", () => {
  const patch = buildLayoutPatch({
    layoutMode: "absolute",
    top: "",
    left: "",
    width: "",
    height: "",
    relativeTargetUserId: "",
    relativePlacement: "",
    relativeGap: "",
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
    overlayFitMode: "",
    overlayAnchor: "",
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
    namePosition: "bottom",
    nameTextAlign: "center",
    nameFontWeight: "600",
    nameFontStyle: "normal",
    geometryBorderRadius: "8"
  });

  assert.equal(patch.geometry.borderRadius, "8px");
});

test("inferLayoutMode supports legacy layouts", () => {
  assert.equal(inferLayoutMode({ position: "relative" }), "relative");
  assert.equal(inferLayoutMode({ relative: { targetUserId: "u2" } }), "relative");
  assert.equal(inferLayoutMode({ position: "absolute" }), "absolute");
  assert.equal(inferLayoutMode({ layoutMode: "relative" }), "relative");
});

test("normalizedLayoutMode falls back safely", () => {
  assert.equal(normalizedLayoutMode("absolute"), "absolute");
  assert.equal(normalizedLayoutMode("relative"), "relative");
  assert.equal(normalizedLayoutMode("invalid"), "absolute");
  assert.equal(normalizedLayoutMode(""), "absolute");
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
    nameFontSize: "",
    nameLineHeight: "",
    namePosition: "top",
    nameOffset: "",
    namePaddingX: "",
    namePaddingY: "",
    nameCustomBackground: false,
    nameBackgroundColor: "#000000",
    nameBackgroundOpacity: 0.86,
    nameCustomBorder: false,
    nameBorderColor: "#ffffff",
    nameBorderWidth: "",
    nameBorderRadius: "",
    nameTextAlign: "center",
    nameFontWeight: "600",
    nameFontStyle: "normal"
  });
  assert.deepEqual(Object.keys(patch), ["nameStyle"]);
  assert.equal(patch.nameStyle.position, "top");
  assert.equal(patch.nameStyle.textAlign, "center");
  assert.equal(patch.nameStyle.background.enabled, false);
  assert.equal(patch.nameStyle.border.enabled, false);
});

test("validateLayoutFormData rejects self target and missing placement", () => {
  const validation = validateLayoutFormData(
    "u1",
    {
      layoutMode: "relative",
      relativeTargetUserId: "u1",
      relativePlacement: "none"
    },
    {},
    [{ id: "u1", active: true, name: "GM" }]
  );

  assert.deepEqual(validation.errors, ["relativeTargetSelf", "relativePlacementRequired"]);
  assert.deepEqual(validation.warnings, []);
});

test("validateLayoutFormData detects dependency cycles and offline targets", () => {
  const validation = validateLayoutFormData(
    "u1",
    {
      layoutMode: "relative",
      relativeTargetUserId: "u2",
      relativePlacement: "below-center"
    },
    {
      u2: {
        layoutMode: "relative",
        relative: {
          targetUserId: "u1",
          placement: "below-center",
          gap: "12px"
        }
      }
    },
    [
      { id: "u1", active: true, name: "GM" },
      { id: "u2", active: false, name: "Player" }
    ]
  );

  assert.deepEqual(validation.errors, ["relativeCycle"]);
  assert.deepEqual(validation.warnings, ["relativeTargetOffline"]);
});
