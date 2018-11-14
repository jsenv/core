import { executeOnNode } from "./executeOnNode.js"
import path from "path"
import { createJsCompileService } from "../createJsCompileService.js"
import { teardownForOutputAndCoverageMap } from "../platformTeardown.js"
import assert from "assert"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const watch = false
const instrument = true
// const file = "src/__test__/file.js"
const file = `src/createExecuteOnNode/fixtures/file.js`

const exec = async ({ cancellationToken }) => {
  const jsCompileService = await createJsCompileService({
    cancellationToken,
    localRoot,
    compileInto,
  })

  const result = await executeOnNode({
    cancellationToken,
    localRoot,
    compileInto,
    compileService: jsCompileService,

    watch,

    file,
    instrument,
    teardown: teardownForOutputAndCoverageMap,
    verbose: true,
  })

  return result
}

exec({}).then(({ output, coverage }) => {
  assert.equal(output, "foo")
  assert.equal(file in coverage, true)
  console.log("passed")
})
