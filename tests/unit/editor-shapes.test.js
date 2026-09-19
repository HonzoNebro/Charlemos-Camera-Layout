import test from "node:test";
import assert from "node:assert/strict";
import { parseGuidedShape, guidedShapeCss, updateGuidedShape } from "../../scripts/editor-shapes.js";

test("guided shapes recognize legacy presets and explicitly edited parameters", () => {
  assert.deepEqual(parseGuidedShape("circle(45%)"), { kind: "circle", values: { radius: 45, x: 50, y: 50 } });
  assert.equal(updateGuidedShape("circle(45%)", "x", "30.5"), "circle(45% at 30.5% 50%)");
  assert.equal(updateGuidedShape("ellipse(40% 30%)", "ry", "25"), "ellipse(40% 25% at 50% 50%)");
  assert.equal(updateGuidedShape("inset(8% round 10px)", "right", "12"), "inset(8% 12% 8% 8% round 10px)");
  for (const css of ["inset(1% 2% round 0px)", "inset(1% 2% 3% round 0px)", "inset(1% 2% 3% 4% round 2.5px)"]) {
    const shape = parseGuidedShape(css);
    assert.deepEqual(parseGuidedShape(guidedShapeCss(shape.kind, shape.values)), shape);
  }
  const polygon = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
  assert.deepEqual(parseGuidedShape(polygon), {
    kind: "polygon",
    values: { x1: 50, y1: 0, x2: 100, y2: 50, x3: 50, y3: 100, x4: 0, y4: 50 }
  });
  assert.equal(updateGuidedShape(polygon, "x2", "90"), "polygon(50% 0%, 90% 50%, 50% 100%, 0% 50%)");
});

test("custom CSS is never reconstructed by guided controls", () => {
  for (const css of ["polygon(50% 0%,100% 100%,0% 100%)", "circle(closest-side)", "ellipse(40px 30px)", "inset(calc(10% + 2px))", "circle(40%) border-box", "url(#mask)", "inset(8% round 2px 4px)", "circle(-10%)"]) {
    assert.equal(parseGuidedShape(css), null, css);
    assert.equal(updateGuidedShape(css, "x", 10), null, css);
  }
});

test("guided controls reject invalid numbers, unknown fields and crossed insets", () => {
  for (const value of ["", " ", "calc(2px)", -1, 101, Infinity, NaN]) assert.equal(updateGuidedShape("circle(45%)", "radius", value), null);
  assert.equal(updateGuidedShape("circle(45%)", "__proto__", 10), null);
  assert.equal(guidedShapeCss("toString", {}), null);
  assert.equal(updateGuidedShape("inset(8% round 10px)", "top", 93), null);
  assert.equal(updateGuidedShape("inset(8% round 10px)", "round", 500), "inset(8% 8% 8% 8% round 500px)");
});
