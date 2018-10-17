import { createCompile } from "./createCompile.js"
import istanbul from "istanbul"
import fs from "fs"
import path from "path"
import { getPluginsFromNames } from "@dmail/project-structure-compile-babel"

const babelPlugins = getPluginsFromNames(["transform-block-scoping"])
const root = path.resolve(__dirname, "../../../")
const file = "src/createCompileJS/file.js"
const filename = `${root}/${file}`

const compileJS = createCompile({
  createOptions: () => {
    return {
      instrument: true,
    }
  },
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
  }).then(({ output }) => {
    eval(output)
    const collector = new istanbul.Collector()
    collector.add(global.__coverage__)
    // const finalCoverage = collector.getFinalCoverage()
    const reporter = new istanbul.Reporter()

    reporter.add("text")
    reporter.add("html")
    reporter.write(collector, false, () => {})
  })
})
