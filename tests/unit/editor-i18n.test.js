import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("new editor labels have translations in all supported languages", () => {
  const files = ["camera-editor-app", "editor-fields", "editor-compositions", "visual-camera-editor"];
  const keys = new Set(files.flatMap((file) => [...readFileSync(new URL(`../../scripts/${file}.js`, import.meta.url), "utf8").matchAll(/\b(?:t|editorText)\("([^"]+)"\)/g)].map((match) => match[1])));
  for (const lang of ["en", "es", "gl"]) {
    const dictionary = JSON.parse(readFileSync(new URL(`../../lang/${lang}.json`, import.meta.url)));
    for (const key of keys) assert.ok(dictionary[`charlemos-camera-layout.ui.editor.${key}`], `${lang}: ${key}`);
  }
});
