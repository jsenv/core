import fs from "fs"
import { assert } from "/node_modules/@dmail/assert/index.js"
import { objectMap } from "../../../objectHelper.js"
import { createInstrumentPlugin } from "../../../cover/createInstrumentPlugin.js"
import { jsCompile } from "../../jsCompile.js.js.js"

const istanbul = import.meta.require("istanbul")
const transformBlockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../../jsenv.config.js")

const root = `${projectFolder}/src/jsCompile/test/fixtures`
const file = "file.js"
const fileAbsolute = `${root}/${file}`
const babelConfigMap = {
  "transform-block-scoping": [transformBlockScoping],
  "transform-instrument": [createInstrumentPlugin()],
}

jsCompile({
  localRoot: root,
  file,
  fileAbsolute,
  input: fs.readFileSync(fileAbsolute).toString(),
  babelConfigMap,
  instrument: true,
}).then(({ assets, output }) => {
  assert({ actual: assets, expected: ["file.js.map", "coverage.json"] })
  eval(output)

  const coverage = global.__coverage__
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
