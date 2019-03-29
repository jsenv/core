import fs from "fs"
import { assert } from "/node_modules/@dmail/assert/index.js"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { jsCompile } from "../../jsCompile.js"

const projectFolder = `${selfProjectFolder}/src/jsCompile/test/empty`
const filenameRelative = "empty.js"
const filename = `${projectFolder}/${filenameRelative}`
const input = fs.readFileSync(filename).toString()
const babelPluginDescription = pluginOptionMapToPluginMap({
  "transform-block-scoping": {},
})

;(async () => {
  const actual = await jsCompile({
    input,
    filename,
    filenameRelative,
    projectFolder,
    babelPluginDescription,
  })
  assert({
    actual,
    expected: {
      sources: [],
      sourcesContent: [],
      assets: ["empty.js.map"],
      assetsContent: actual.assetsContent,
      output: actual.output,
    },
  })
})()
