import fs from "fs"
import transformBlockScoping from "@babel/plugin-transform-block-scoping"
import istanbul from "istanbul"
import { assert } from "/node_modules/@dmail/assert/index.js"
import { projectFolder } from "../../../../projectFolder.js"
import { objectMap } from "../../../objectHelper.js"
import { createInstrumentPlugin } from "../../../cover/createInstrumentPlugin.js"
import { jsCompile } from "../../jsCompile.js"

const root = `${projectFolder}/src/jsCompile/test/fixtures`
const file = "file.js"
const fileAbsolute = `${root}/${file}`
const babelPluginDescription = {
  "transform-block-scoping": [transformBlockScoping],
  "transform-instrument": [createInstrumentPlugin()],
}

jsCompile({
  localRoot: root,
  file,
  fileAbsolute,
  input: fs.readFileSync(fileAbsolute).toString(),
  babelPluginDescription,
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
