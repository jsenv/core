import { assert } from "@dmail/assert"
import { compileJs } from "../../../../src/compiled-js-service/compileJs.js"

const { projectPath } = import.meta.require("../../../../jsenv.config.js")

const testFolder = `${projectPath}/src/jsCompile/test/fixtures`
const file = "folder/file.js"
const fileAbsolute = `${testFolder}/${file}`
const input = `true`

compileJs({
  projectPath: testFolder,
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
