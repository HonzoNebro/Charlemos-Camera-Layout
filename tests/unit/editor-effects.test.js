import test from "node:test";
import assert from "node:assert/strict";
import { parseBasicEffects, updateBasicEffect } from "../../scripts/editor-effects.js";

test("basic effects preserve ordering and unrelated effect values", () => {
  assert.equal(updateBasicEffect("scale(2) rotate(10deg)", "scale", 1.5), "scale(1.5) rotate(10deg)");
  assert.equal(updateBasicEffect("scale(2) rotate(10deg)", "scale", null), "rotate(10deg)");
  assert.equal(updateBasicEffect("blur(1px)", "brightness", 1.2), "blur(1px) brightness(1.2)");
});

test("custom and repeated functions are not destructively interpreted", () => {
  for (const css of ["translateX(calc(10% + 2px))", "rotate(10deg) rotate(2deg)", "matrix(1,0,0,1,0,0)"]) {
    assert.equal(parseBasicEffects(css, "transform"), null);
    assert.equal(updateBasicEffect(css, "rotate", 3), null);
  }
  assert.equal(updateBasicEffect("", "scale", -1), null);
});
