import fs from "fs"
import { assert } from "/node_modules/@dmail/assert/index.js"
import { jsCompile } from "../../jsCompile.js"

const transformBlockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../../jsenv.config.js")

const testFolder = `${projectFolder}/src/jsCompile/test/empty`
const filenameRelative = "empty.js"
const filename = `${projectFolder}/${filenameRelative}`
const input = fs.readFileSync(filename).toString()
const babelConfigMap = {
  "transform-block-scoping": [transformBlockScoping],
}

;(async () => {
  const actual = await jsCompile({
    input,
    filename,
    filenameRelative,
    projectFolder: testFolder,
    babelConfigMap,
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
