import { executeOnNode } from "./executeOnNode.js"
import path from "path"
import { createJSCompileServiceForProject } from "../createJSCompileServiceForProject.js"
import { teardownForOutputAndCoverage } from "../platformTeardown.js"
import assert from "assert"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const watch = false
const instrument = true
// const file = "src/__test__/file.js"
const file = `src/createExecuteOnNode/fixtures/file.js`

createJSCompileServiceForProject({ localRoot, compileInto })
  .then(({ compileService, watchPredicate, groupMapFile }) => {
    return executeOnNode({
      localRoot,
      compileInto,
      compileService,
      groupMapFile,

      watch,
      watchPredicate,

      file,
      instrument,
      teardown: teardownForOutputAndCoverage,
      verbose: true,
    })
  })
  .then((result) => {
    assert.equal(result.output, "foo")
    assert.equal(file in result.coverage, true)

    console.log("passed")
  })
