import { createCompile } from "./createCompile.js"
import { instrumenter } from "./instrumenter-babel.js"
import istanbul from "istanbul"
import fs from "fs"
import path from "path"

const compile = createCompile({
  instrumenter,
  createOptions: () => {
    return {
      transpile: true,
      instrument: true,
      remapMethod: "comment",
    }
  },
})

const projectRoot = path.resolve(__dirname, "../../../")
const filename = `${projectRoot}/src/createCompile/file.js`

compile({
  rootLocation: projectRoot,
  filename,
  inputRelativeLocation: "src/createCompile/file.js",
  inputSource: fs.readFileSync(filename).toString(),
  groupId: "nothing",
}).then(({ generate }) => {
  return generate({
    outputRelativeLocation: "file.compiled.js",
    getBabelPlugins: () => [],
  }).then(({ output }) => {
    global.System = {
      register: (dependencies, fn) => {
        fn(() => {}, {}).execute()
      },
    }

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
