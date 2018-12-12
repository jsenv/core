import fs from "fs"
import istanbul from "istanbul"
import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot as projectRoot } from "../../localRoot.js"
import { objectMap } from "../../objectHelper.js"
import { createInstrumentPlugin } from "../createInstrumentPlugin.js"
import { jsCompile } from "../jsCompile.js"

const localRoot = `${projectRoot}/src/jsCompile/test/fixtures`
const file = "file.js"
const fileAbsolute = `${localRoot}/${file}`
const pluginMap = pluginOptionMapToPluginMap({
  "transform-block-scoping": {},
})
pluginMap["transform-instrument"] = createInstrumentPlugin()

jsCompile({
  localRoot,
  file,
  fileAbsolute,
  input: fs.readFileSync(fileAbsolute).toString(),
  pluginMap,
  instrument: true,
}).then(({ assets, output }) => {
  assert({ actual: assets, expected: ["file.js.map", "coverage.json"] })
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
