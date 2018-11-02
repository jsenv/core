import { executeOnNode } from "./executeOnNode.js"
import path from "path"
import { jsCreateCompileServiceForProject } from "../jsCreateCompileServiceForProject.js"
import { teardownForOutputAndCoverage } from "../platformTeardown.js"
import assert from "assert"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const watch = false
const instrument = true
// const file = "src/__test__/file.js"
const file = `src/createExecuteOnNode/fixtures/file.js`

const exec = async ({ cancellation }) => {
  const { compileService, watchPredicate, groupMapFile } = await jsCreateCompileServiceForProject({
    cancellation,
    localRoot,
    compileInto,
  })

  const result = await executeOnNode({
    cancellation,
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

  return result
}

exec({}).then(({ output, coverage }) => {
  assert.equal(output, "foo")
  assert.equal(file in coverage, true)
  console.log("passed")
})
