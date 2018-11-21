import fs from "fs"
import path from "path"
import assert from "assert"
import istanbul from "istanbul"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { objectMap } from "../objectHelper.js"
import { createInstrumentPlugin } from "./createInstrumentPlugin.js"
import { jsCompile } from "./jsCompile.js"

const pluginMap = pluginOptionMapToPluginMap({
  // "transform-modules-systemjs": {},

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
pluginMap["transform-instrument"] = createInstrumentPlugin()
const localRoot = path.resolve(__dirname, "../../../")
const file = "src/jsCompile/fixtures/file.js"
const fileAbsolute = `${localRoot}/${file}`

jsCompile({
  localRoot,
  file,
  fileAbsolute,
  input: fs.readFileSync(fileAbsolute).toString(),
  pluginMap,
  instrument: true,
}).then(({ assets, output }) => {
  assert.deepEqual(assets, ["file.js.map", "coverage.json"])
  eval(output)

  const coverage = global.__coverage__
  const absoluteCoverage = objectMap(coverage, (file, coverage) => {
    return {
      [`${localRoot}/${file}`]: { ...coverage, path: `${localRoot}/${file}` },
    }
  })
  const collector = new istanbul.Collector()
  collector.add(absoluteCoverage)
  // const finalCoverage = collector.getFinalCoverage()
  const reporter = new istanbul.Reporter()

  reporter.add("text")
  reporter.add("html")
  reporter.write(collector, false, () => {})

  console.log("passed")
})
