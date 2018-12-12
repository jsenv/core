import { assert } from "@dmail/assert"
import { localRoot as projectRoot } from "../../localRoot.js"
import { jsCompile } from "../jsCompile.js"

const localRoot = `${projectRoot}/src/jsCompile/test/fixtures`
const file = "folder/file.js"
const fileAbsolute = `${localRoot}/${file}`
const input = `true`

jsCompile({
  localRoot,
  file,
  fileAbsolute,
  input,
}).then(({ output }) => {
  assert({
    actual: output,
    expected: `true;
//# sourceMappingURL=/folder/file.js__meta__/file.js.map`,
  })
})
