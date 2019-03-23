import fs from "fs"
import { assert } from "@dmail/assert"
import { projectFolder } from "../../../../projectFolder.js"
import { jsCompile } from "../../jsCompile.js"

const testFolder = `${projectFolder}/src/jsCompile/test/fixtures`
const file = "module.js"
const fileAbsolute = `${testFolder}/${file}`
const input = fs.readFileSync(fileAbsolute).toString()
const babelPluginDescription = {}

jsCompile({
  projectFolder: testFolder,
  file,
  fileAbsolute,
  input,
  babelPluginDescription,
}).then(({ output }) => {
  assert({ actual: output.includes("System.register"), expected: true })
})
