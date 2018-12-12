import fs from "fs"
import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot as projectRoot } from "../../localRoot.js"
import { jsCompile } from "../jsCompile.js"

const localRoot = `${projectRoot}/src/jsCompile/test/fixtures`
const file = "module.js"
const fileAbsolute = `${localRoot}/${file}`
const input = fs.readFileSync(fileAbsolute).toString()
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

jsCompile({
  localRoot,
  file,
  fileAbsolute,
  input,
  pluginMap,
}).then(({ output }) => {
  assert({ actual: output.includes("System.register"), expected: true })
})
