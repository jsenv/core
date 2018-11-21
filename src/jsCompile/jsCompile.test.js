import fs from "fs"
import path from "path"
import assert from "assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { jsCompile } from "./jsCompile.js"

const localRoot = path.resolve(__dirname, "../../../")
const file = "src/jsCompile/fixtures/file.js"
const fileAbsolute = `${localRoot}/${file}`
const input = fs.readFileSync(fileAbsolute).toString()
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},

  "proposal-async-generator-functions": {},
  "proposal-json-strings": {},
  "proposal-object-rest-spread": {},
  "proposal-optional-catch-binding": {},
  "proposal-unicode-property-regex": {},
  "transform-arrow-functions": {},
  "transform-async-to-generator": {},
  "transform-block-scoped-functions": {},
  "transform-block-scoping": {},
  "transform-classes": {},
  "transform-computed-properties": {},
  "transform-destructuring": {},
  "transform-dotall-regex": {},
  "transform-duplicate-keys": {},
  "transform-exponentiation-operator": {},
  "transform-for-of": {},
  "transform-function-name": {},
  "transform-literals": {},
  "transform-new-target": {},
  "transform-object-super": {},
  "transform-parameters": {},
  "transform-regenerator": {},
  "transform-shorthand-properties": {},
  "transform-spread": {},
  "transform-sticky-regex": {},
  "transform-template-literals": {},
  "transform-typeof-symbol": {},
  "transform-unicode-regex": {},
})

jsCompile({
  localRoot,
  file,
  fileAbsolute,
  input,
  pluginMap,
}).then(({ sources, sourcesContent, assets, assetsContent, output }) => {
  assert.deepEqual(sources, [file])
  assert.deepEqual(sourcesContent, [input])
  assert.deepEqual(assets, ["file.js.map"])
  const map = JSON.parse(assetsContent[0])
  assert.deepEqual(map.file, file)
  assert.deepEqual(map.sources, [`/${file}`])
  assert.deepEqual(map.sourcesContent, undefined)
  assert.deepEqual(typeof output, "string")
  assert.deepEqual(output.length > 0, true)

  console.log("passed")
})
