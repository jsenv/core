import { createCompile } from "./createCompile.js"
import istanbul from "istanbul"
import fs from "fs"
import path from "path"
import { getPluginsFromNames } from "@dmail/project-structure-compile-babel"
import { objectMap } from "../../coverageMap/objectHelper.js"
import assert from "assert"

const babelPlugins = getPluginsFromNames(["transform-block-scoping"])
const root = path.resolve(__dirname, "../../../")
const file = "src/createCompile/file.js"
const filename = `${root}/${file}`

const compileJS = createCompile({
  instrument: true,
})

compileJS({
  root,
  inputName: file,
  inputSource: fs.readFileSync(filename).toString(),
  groupId: "nothing",
}).then(({ generate }) => {
  return generate({
    outputName: "file.compiled.js",
    getBabelPlugins: () => babelPlugins,
  }).then(({ output, outputAssets }) => {
    eval(output)
    const coverage = global.__coverage__
    assert.equal(outputAssets.length, 2)
    assert.equal(outputAssets[1].name, "coverage.json")
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
  })
})
