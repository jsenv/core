import fs from "fs"
import { assert } from "@dmail/assert"
import { root as selfRoot } from "../../root.js"
import { jsCompile } from "../../jsCompile.js"

const root = `${selfRoot}/src/jsCompile/test/fixtures`
const file = "module.js"
const fileAbsolute = `${root}/${file}`
const input = fs.readFileSync(fileAbsolute).toString()
const babelPluginDescription = {}

jsCompile({
  root,
  file,
  fileAbsolute,
  input,
  babelPluginDescription,
}).then(({ output }) => {
  assert({ actual: output.includes("System.register"), expected: true })
})
