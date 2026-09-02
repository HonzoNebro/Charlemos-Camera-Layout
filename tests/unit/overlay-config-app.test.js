import test from "node:test";
import assert from "node:assert/strict";

async function importOverlayModule() {
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: class {}
      }
    },
    utils: {
      escapeHTML: (value) => String(value ?? "")
    }
  };
  return import(`../../scripts/overlay-config-app.js?test=${Date.now()}-${Math.random()}`);
}

test("buildOverlayPatch keeps only overlay-specific fields", async () => {
  const { buildOverlayPatch } = await importOverlayModule();
  const patch = buildOverlayPatch({
    layoutMode: "absolute",
    top: "10px",
    left: "20px",
    width: "320px",
    height: "180px",
    relativeTargetUserId: "u2",
    relativePlacement: "below-center",
    relativeGap: "12px",
    cropTop: "5px",
    cropRight: "",
    cropBottom: "",
    cropLeft: "",
    transform: "rotate(3deg)",
    filter: "blur(1px)",
    clipPath: "circle(45%)",
    overlayEnabled: true,
    overlayImage: "modules/example/frame.png",
    overlayOpacity: "0.75",
    overlayOffsetX: "10",
    overlayOffsetY: "-4%",
    overlayScale: "1.2",
    overlayRotate: "15",
    overlayFitMode: "contain",
    overlayAnchor: "bottom-right",
    overlayTintEnabled: true,
    overlayTintColor: "#112233",
    overlayTintOpacity: "0.5",
    overlayTintBlendMode: "screen",
    nameVisible: true,
    geometryBorderRadius: "12px",
    geometryTransparentFrame: true
  });

  assert.deepEqual(patch, {
    overlay: {
      enabled: true,
      imageUrl: "modules/example/frame.png",
      opacity: 0.75,
      offset: {
        x: "10px",
        y: "-4%"
      },
      scale: 1.2,
      rotate: 15,
      fitMode: "contain",
      anchor: "bottom-right",
      bounds: {
        mode: "camera",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      },
      tint: {
        enabled: true,
        color: "#112233",
        opacity: 0.5,
        blendMode: "screen"
      }
    }
  });
});

test("buildOverlayPatch preserves expanded bounds and clamps invalid percentages", async () => {
  const { buildOverlayPatch } = await importOverlayModule();
  const patch = buildOverlayPatch({
    overlayEnabled: true,
    overlayBoundsMode: "expanded",
    overlayBoundsTop: "10.5",
    overlayBoundsRight: "600",
    overlayBoundsBottom: "-1",
    overlayBoundsLeft: "bad"
  });

  assert.deepEqual(patch.overlay.bounds, {
    mode: "expanded",
    top: 10.5,
    right: 500,
    bottom: 0,
    left: 0
  });
});

test("syncOverlayBoundsMode enables extension fields only in expanded mode", async () => {
  const { syncOverlayBoundsMode } = await importOverlayModule();
  const fields = new Map([
    ["overlayBoundsMode", { value: "camera" }],
    ["overlayBoundsTop", { disabled: false }],
    ["overlayBoundsRight", { disabled: false }],
    ["overlayBoundsBottom", { disabled: false }],
    ["overlayBoundsLeft", { disabled: false }]
  ]);
  const boundsFields = { dataset: {} };
  const form = {
    elements: {
      namedItem: (name) => fields.get(name) ?? null
    },
    querySelector: (selector) => (selector === "[data-overlay-bounds-fields]" ? boundsFields : null)
  };

  syncOverlayBoundsMode(form);

  assert.equal(boundsFields.dataset.enabled, "false");
  ["overlayBoundsTop", "overlayBoundsRight", "overlayBoundsBottom", "overlayBoundsLeft"].forEach((name) => {
    assert.equal(fields.get(name).disabled, true);
  });

  fields.get("overlayBoundsMode").value = "expanded";
  syncOverlayBoundsMode(form);

  assert.equal(boundsFields.dataset.enabled, "true");
  ["overlayBoundsTop", "overlayBoundsRight", "overlayBoundsBottom", "overlayBoundsLeft"].forEach((name) => {
    assert.equal(fields.get(name).disabled, false);
  });
});

test("overlay form shows its readonly camera anchor and expanded bounds", async () => {
  globalThis.canvas = { scene: { id: "scene-a" } };
  globalThis.game = {
    user: { id: "u1" },
    users: {
      contents: [{ id: "u1", name: "Player One", active: true }]
    },
    i18n: {
      localize: (key) => key
    },
    settings: {
      get: (_moduleId, key) => key === "sceneProfiles"
        ? {
            "scene-a": {
              enabled: true,
              layouts: {
                u1: {
                  overlay: {
                    enabled: true,
                    bounds: { mode: "expanded", top: 10, right: 20, bottom: 30, left: 40 }
                  }
                }
              }
            }
          }
        : {}
    }
  };
  const { OverlayConfigApp } = await importOverlayModule();
  const app = new OverlayConfigApp({ selectedUserId: "u1" });
  app.id = "overlay-test";

  const context = await app._prepareContext();
  const html = await app._renderHTML(context);

  assert.match(html, /name="overlayCameraAnchor" value="Player One" readonly/);
  assert.match(html, /option value="expanded" selected/);
  assert.match(html, /name="overlayBoundsTop" value="10"/);
  assert.match(html, /name="overlayBoundsLeft" value="40"/);
  assert.match(html, /data-overlay-bounds-fields data-enabled="true"/);
});
