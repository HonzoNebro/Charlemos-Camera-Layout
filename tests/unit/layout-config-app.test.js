import test from "node:test";
import assert from "node:assert/strict";

function installLayoutConfigEnv() {
  const store = {
    playerLayouts: {},
    sceneProfiles: {},
    sceneCamera: {}
  };

  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null
  };
  globalThis.canvas = {
    scene: null
  };
  globalThis.game = {
    user: {
      id: "u1"
    },
    users: {
      contents: [{ id: "u1", name: "GM", active: true }]
    },
    i18n: {
      localize: (key) => key
    },
    settings: {
      get: (_moduleId, key) => store[key],
      set: async (_moduleId, key, value) => {
        store[key] = value;
        return value;
      }
    }
  };
  globalThis.ui = {
    notifications: {
      info: () => {},
      error: () => {}
    }
  };
  globalThis.foundry = {
    utils: {
      escapeHTML: (value) => String(value ?? ""),
      deepClone: (value) => structuredClone(value),
      mergeObject: (target, source) => ({ ...(target ?? {}), ...(source ?? {}) })
    },
    applications: {
      api: {
        ApplicationV2: class {
          constructor() {
            this.id = "layout-app";
          }
        }
      }
    }
  };

  return store;
}

function createForm(values = {}) {
  const fields = new Map(
    Object.entries({
      layoutMode: "absolute",
      cameraControlMode: "native",
      top: "",
      left: "",
      width: "",
      height: "",
      relativeTargetUserId: "",
      relativePlacement: "none",
      relativeGap: "",
      cropTop: "",
      cropRight: "",
      cropBottom: "",
      cropLeft: "",
      ...values
    }).map(([name, value]) => [name, { value, disabled: false }])
  );

  return {
    elements: {
      namedItem(name) {
        return fields.get(name) ?? null;
      }
    },
    querySelector() {
      return { disabled: false };
    }
  };
}

test("layout config closes after successful save", async () => {
  const store = installLayoutConfigEnv();
  const { LayoutConfigApp } = await import("../../scripts/layout-config-app.js");

  const app = new LayoutConfigApp({ selectedUserId: "u1" });
  let closed = false;
  app.close = async () => {
    closed = true;
  };

  await app.saveForm(createForm());

  assert.equal(closed, true);
  assert.deepEqual(store.playerLayouts.u1, {
    crop: {
      top: null,
      right: null,
      bottom: null,
      left: null
    }
  });
});
