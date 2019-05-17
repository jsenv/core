import fs from "fs"
import { assert } from "/node_modules/@dmail/assert/index.js"
import { compileJs } from "../../compileJs.js"

const { projectFolder } = import.meta.require("../../../../jsenv.config.js")

const testFolder = `${projectFolder}/src/jsCompile/test/fixtures`
const file = "module.js"
const fileAbsolute = `${testFolder}/${file}`
const input = fs.readFileSync(fileAbsolute).toString()
const babelConfigMap = {}

compileJs({
  projectFolder: testFolder,
  file,
  fileAbsolute,
  input,
  babelConfigMap,
}).then(({ output }) => {
  assert({ actual: output.includes("System.register"), expected: true })
})
