import test from "node:test";
import assert from "node:assert/strict";
import { replaceAppContent } from "../../scripts/dom-replace.js";

test("replaceAppContent writes string html", () => {
  const content = { innerHTML: "", replaceChildren: () => {} };
  replaceAppContent(content, "<div>A</div>");
  assert.equal(content.innerHTML, "<div>A</div>");
});

test("replaceAppContent handles null result", () => {
  const content = { innerHTML: "x", replaceChildren: () => {} };
  replaceAppContent(content, null);
  assert.equal(content.innerHTML, "");
});

test("camera config hub html renders player selector and actions", async () => {
  globalThis.game = {
    i18n: {
      localize: (key) => key
    }
  };
  globalThis.foundry = {
    utils: {
      escapeHTML: (value) => String(value ?? "")
    },
    applications: {
      api: {
        ApplicationV2: class {}
      }
    }
  };
  const { buildHtml } = await import("../../scripts/camera-config-app.js");

  const html = buildHtml({
    shellId: "shell-id",
    formId: "form-id",
    playerSelectId: "player-id",
    title: "Config",
    users: [{ id: "u1", name: "GM", active: true }],
    selectedUserId: "u1",
    formData: {
      layoutMode: "absolute",
      top: "",
      left: "",
      width: "",
      height: "",
      relativePlacement: "none",
      relativeTargetUserId: "",
      cropTop: "",
      cropRight: "",
      cropBottom: "",
      cropLeft: "",
      transform: "",
      filter: "",
      clipPath: "",
      geometryBorderRadius: "",
      overlayEnabled: false,
      overlayImage: "",
      overlayFitMode: "auto",
      overlayAnchor: "center",
      nameVisible: true,
      nameSource: "user",
      namePosition: "bottom"
    }
  });

  assert.match(html, /player-id/);
  assert.match(html, /open-layout-config/);
  assert.match(html, /reset-current-player/);
});
