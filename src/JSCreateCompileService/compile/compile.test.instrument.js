import { compile } from "./compile.js"
import istanbul from "istanbul"
import fs from "fs"
import path from "path"
import { pluginNameToPlugin } from "@dmail/project-structure-compile-babel"
import { objectMap } from "../../objectHelper.js"
import assert from "assert"
import { createInstrumentPlugin } from "./createInstrumentPlugin.js"

const pluginNames = [
  "proposal-async-generator-functions",
  "proposal-json-strings",
  "proposal-object-rest-spread",
  "proposal-optional-catch-binding",
  "proposal-unicode-property-regex",
  "transform-arrow-functions",
  "transform-async-to-generator",
  "transform-block-scoped-functions",
  "transform-block-scoping",
  "transform-classes",
  "transform-computed-properties",
  "transform-destructuring",
  "transform-dotall-regex",
  "transform-duplicate-keys",
  "transform-exponentiation-operator",
  "transform-for-of",
  "transform-function-name",
  "transform-literals",
  // "transform-modules-systemjs",
  "transform-new-target",
  "transform-object-super",
  "transform-parameters",
  "transform-regenerator",
  "transform-shorthand-properties",
  "transform-spread",
  "transform-sticky-regex",
  "transform-template-literals",
  "transform-typeof-symbol",
  "transform-unicode-regex",
]
const babelPlugins = pluginNames.map(pluginNameToPlugin)
babelPlugins.push(createInstrumentPlugin())
const root = path.resolve(__dirname, "../../../")
const file = "src/jsCreateCompileService/compile/fixtures/file.js"
const filename = `${root}/${file}`

compile({
  root,
  plugins: babelPlugins,
  inputName: file,
  instrument: true,
  inputSource: fs.readFileSync(filename).toString(),
  outputName: "file.compiled.js",
}).then(({ outputSource, assetMap }) => {
  eval(outputSource)
  const coverage = global.__coverage__
  assert.equal(typeof assetMap["file.js.map"], "string")
  assert.equal(typeof assetMap["coverage.json"], "string")

  const absoluteCoverage = objectMap(coverage, (file, coverage) => {
    return {
      [`${root}/${file}`]: { ...coverage, path: `${root}/${file}` },
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
