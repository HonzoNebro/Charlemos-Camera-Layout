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
