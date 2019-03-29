import { assert } from "/node_modules/@dmail/assert/index.js"
import { projectFolder } from "../../../../projectFolder.js"
import { jsCompile } from "../../jsCompile.js"

const testFolder = `${projectFolder}/src/jsCompile/test/fixtures`
const file = "folder/file.js"
const fileAbsolute = `${testFolder}/${file}`
const input = `true`

jsCompile({
  projectFolder: testFolder,
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
