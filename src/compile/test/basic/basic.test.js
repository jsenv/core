import { assert } from "@dmail/assert"
import { computeCompileInstruction } from "../../computeCompileInstruction.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = `src/compile/test/basic`
const root = `${localRoot}/${testRoot}`

;(async () => {
  const actual = await computeCompileInstruction({
    root,
  })
  debugger
  const expected = {}
  assert({ actual, expected })
})()
