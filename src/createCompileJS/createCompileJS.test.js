import { createCompileJS } from "./createCompileJS.js"
import { instrumenter } from "./instrumenter-babel.js"
import istanbul from "istanbul"
import fs from "fs"
import path from "path"

const compileJS = createCompileJS({
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
const file = "src/createCompile/file.js"
const filename = `${projectRoot}/${file}`

compileJS({
  root: projectRoot,
  inputName: file,
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
