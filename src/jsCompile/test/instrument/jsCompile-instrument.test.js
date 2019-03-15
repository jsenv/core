import fs from "fs"
import istanbul from "istanbul"
import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { root as selfRoot } from "../../root.js"
import { objectMap } from "../../../objectHelper.js"
import { createInstrumentPlugin } from "../../../cover/createInstrumentPlugin.js"
import { jsCompile } from "../../jsCompile.js"

const root = `${selfRoot}/src/jsCompile/test/fixtures`
const file = "file.js"
const fileAbsolute = `${root}/${file}`
const babelPluginDescription = pluginOptionMapToPluginMap({
  "transform-block-scoping": {},
})
babelPluginDescription["transform-instrument"] = createInstrumentPlugin()

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
