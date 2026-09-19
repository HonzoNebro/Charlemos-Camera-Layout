import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { profileForAudience } from "../../scripts/role-variants.js";
import { overlayStyle, overlayMediaStyle } from "../../scripts/camera-layout-style.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/viewer-layout-snapshots.json", import.meta.url), "utf8"));

test("viewer layout regression snapshots preserve dormant geometry and frame fitting", () => {
  const initial = structuredClone(fixture.profile);
  for (let cycle = 0; cycle < 10; cycle++) {
    for (const audience of ["base", "gm", "player", "gm", "base"]) {
      const profile = profileForAudience(fixture.profile, audience);
      const layout = profile.layouts.camera;
      const snapshot = {
        cameraControlMode: profile.cameraControlMode,
        geometry: [layout.left, layout.width, layout.height],
        clipPath: layout.clipPath,
        overlay: overlayStyle(layout),
        media: overlayMediaStyle(layout)
      };
      assert.deepEqual(snapshot, fixture.expected[audience], `${audience}, cycle ${cycle}`);
    }
  }
  assert.deepEqual(fixture.profile, initial);
});
