import fs from "fs"
import transformBlockScoping from "@babel/plugin-transform-block-scoping"
import { assert } from "/node_modules/@dmail/assert/index.js"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { jsCompile } from "../../jsCompile.js"

const projectFolder = `${selfProjectFolder}/src/jsCompile/test/empty`
const filenameRelative = "empty.js"
const filename = `${projectFolder}/${filenameRelative}`
const input = fs.readFileSync(filename).toString()
const babelPluginDescription = {
  "transform-block-scoping": [transformBlockScoping],
}

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
