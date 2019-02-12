import { assert } from "@dmail/assert"
import { root as selfRoot } from "../../root.js"
import { jsCompile } from "../jsCompile.js"

const root = `${selfRoot}/src/jsCompile/test/fixtures`
const file = "folder/file.js"
const fileAbsolute = `${root}/${file}`
const input = `true`

jsCompile({
  localRoot: root,
  file,
  fileAbsolute,
  input,
}).then(({ output }) => {
  assert({
    actual: output,
    expected: `true;
//# sourceMappingURL=/folder/file.js__asset__/file.js.map`,
  })
})
