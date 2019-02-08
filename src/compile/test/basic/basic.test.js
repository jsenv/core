import { assert } from "@dmail/assert"
import { computeCompileInstruction } from "../../computeCompileInstruction.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = `src/compile/test/basic`
const root = `${localRoot}/${testRoot}`

;(async () => {
  const actual = await computeCompileInstruction({
    root,
  })
  const expected = {
    mapping: {},
    files: {
      "index.js": { type: "compile" },
      "node_modules/bar/bar.js": { type: "compile" },
      "node_modules/foo/foo.js": { type: "compile" },
    },
  }
  assert({ actual, expected })
})()
