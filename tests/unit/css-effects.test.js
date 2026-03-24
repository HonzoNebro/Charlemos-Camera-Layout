import test from "node:test";
import assert from "node:assert/strict";
import { addEffect, availableEffectItems, effectDefaultValue, removeEffect, usedEffectIds } from "../../scripts/css-effects.js";

test("usedEffectIds reads function names", () => {
  const ids = usedEffectIds("rotate(2deg) contrast(1.2) blur(1px)");
  assert.deepEqual(ids, ["rotate", "contrast", "blur"]);
});

test("availableEffectItems excludes used effect ids", () => {
  const items = availableEffectItems("filter", "contrast(1.2) blur(1px)");
  const ids = items.map((item) => item.id);
  assert.equal(ids.includes("contrast"), false);
  assert.equal(ids.includes("blur"), false);
  assert.equal(ids.includes("grayscale"), true);
});

test("addEffect appends non-duplicate defaults", () => {
  const next = addEffect("transform", "rotate(2deg)", "scale");
  assert.equal(next, "rotate(2deg) scale(1.05)");
});

test("addEffect does not duplicate existing effect", () => {
  const next = addEffect("transform", "rotate(2deg)", "rotate");
  assert.equal(next, "rotate(2deg)");
});

test("addEffect for clipPath replaces current value", () => {
  const next = addEffect("clipPath", "circle(45%)", "inset");
  assert.equal(next, "inset(8% round 10px)");
});

test("removeEffect clears selected function token", () => {
  const next = removeEffect("filter", "contrast(1.2) blur(1px)", "contrast");
  assert.equal(next, "blur(1px)");
});

test("availableEffectItems returns removed effect after manual clear", () => {
  const items = availableEffectItems("filter", "");
  const ids = items.map((item) => item.id);
  assert.equal(ids.includes("contrast"), true);
});

test("effectDefaultValue returns configured default", () => {
  const value = effectDefaultValue("clipPath", "polygon");
  assert.equal(value, "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)");
});
