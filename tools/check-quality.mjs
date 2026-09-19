import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const json = (path) => JSON.parse(read(path));

function checkManifest() {
  const manifest = json("module.json");
  const version = manifest.version;
  assert.match(version, /^\d+\.\d+\.\d+(?:-beta\.\d+)?$/);
  assert.equal(manifest.id, "charlemos-camera-layout");
  assert.equal(json("package.json").version, version);
  const branch = version.includes("-beta.") ? "preview/ux-editor" : "main";
  assert.equal(manifest.manifest, `https://raw.githubusercontent.com/HonzoNebro/Charlemos-Camera-Layout/${branch}/module.json`);
  assert.equal(manifest.download, `https://github.com/HonzoNebro/Charlemos-Camera-Layout/archive/refs/tags/v${version}.zip`);
  assert.ok(read("CHANGELOG.md").includes(`## [${version}] - `), "Missing matching changelog section");
  for (const path of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map((language) => language.path)]) {
    assert.ok(existsSync(resolve(root, path)), `Missing manifest file: ${path}`);
  }
}

function checkLanguages() {
  const source = json("lang/en.json");
  const keys = Object.keys(source).sort();
  const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const lang of ["en", "es", "gl"]) {
    const dictionary = json(`lang/${lang}.json`);
    assert.deepEqual(Object.keys(dictionary).sort(), keys, `${lang}: translation keys differ`);
    for (const key of keys) {
      assert.equal(typeof dictionary[key], "string", `${lang}: ${key}`);
      assert.ok(dictionary[key].trim(), `${lang}: empty ${key}`);
      assert.deepEqual(placeholders(dictionary[key]), placeholders(source[key]), `${lang}: placeholders differ for ${key}`);
    }
  }
}

function checkSyntax() {
  for (const path of readdirSync(resolve(root, "scripts")).filter((file) => file.endsWith(".js"))) {
    const result = spawnSync(process.execPath, ["--check", resolve(root, "scripts", path)], { encoding: "utf8" });
    assert.equal(result.status, 0, `${path}: ${result.stderr || result.error}`);
  }
}

checkManifest();
checkLanguages();
checkSyntax();
console.log("Quality checks passed: release channel, metadata, assets, translations and JavaScript syntax.");
