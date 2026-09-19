import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../../styles/module.css", import.meta.url), "utf8");

test("config layout stacks cards and fields in one column", () => {
  assert.match(css, /\.charlemos-config-grid\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
  assert.match(css, /\.charlemos-config-card\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
  assert.match(css, /\.charlemos-field\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
});

test("config layout stacks action and picker controls vertically", () => {
  assert.match(css, /\.charlemos-actions\s*\{[\s\S]*flex-direction:\s*column;/);
  assert.match(css, /\.charlemos-effect-controls\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
  assert.match(css, /\.charlemos-image-field\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
});

test("transparent frame mode removes native camera chrome", () => {
  assert.match(css, /\.charlemos-camera-view\.charlemos-transparent-frame[\s\S]*background:\s*transparent\s*!important;/);
  assert.match(css, /\.charlemos-camera-view\.charlemos-transparent-frame[\s\S]*box-shadow:\s*none\s*!important;/);
  assert.match(css, /\.charlemos-camera-view\.charlemos-transparent-frame[\s\S]*outline:\s*none\s*!important;/);
  assert.match(css, /\.charlemos-camera-view\.charlemos-transparent-frame[\s\S]*background-image:\s*none\s*!important;/);
  assert.match(css, /\.charlemos-camera-view\.charlemos-transparent-frame::before/);
  assert.match(css, /\.charlemos-camera-view\.charlemos-transparent-frame \.bottom/);
  assert.match(css, /\.charlemos-camera-view\.charlemos-transparent-frame \.control-bar/);
  assert.match(css, /\.charlemos-camera-view\.charlemos-transparent-frame \.notification-bar/);
});

test("video shape mode removes native viewport surfaces behind a clip", () => {
  assert.match(css, /\.charlemos-camera-view\.charlemos-video-shaped video[\s\S]*background:\s*transparent\s*!important;/);
  assert.match(css, /\.charlemos-camera-view\.charlemos-video-shaped \.video-container::before/);
  assert.match(css, /\.charlemos-camera-view\.charlemos-video-shaped \.video-container::after/);
  assert.match(css, /\.charlemos-camera-view\.charlemos-video-shaped \.camera-container-popout::before/);
  assert.match(css, /\.charlemos-camera-view\.charlemos-video-shaped \.camera-container::after/);
});

test("expanded overlays overflow while the native camera viewport remains clipped", () => {
  assert.match(css, /\.charlemos-camera-view\.charlemos-overlay-expanded\s*\{[\s\S]*?overflow:\s*visible;/);
  assert.match(css, /\.charlemos-camera-view \.charlemos-camera-viewport\s*\{[\s\S]*?overflow:\s*hidden\s*!important;/);
  assert.match(css, /\.charlemos-camera-overlay\s*\{[\s\S]*?pointer-events:\s*none;/);
  assert.match(css, /\.charlemos-camera-name\s*\{[\s\S]*?z-index:\s*6;/);
});
