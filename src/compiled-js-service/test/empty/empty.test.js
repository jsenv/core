import fs from "fs"
import { assert } from "/node_modules/@dmail/assert/index.js"
import { compileJs } from "../../compileJs.js"

const transformBlockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../../jsenv.config.js")

const testFolder = `${projectFolder}/src/jsCompile/test/empty`
const fileRelativePath = "/empty.js"
const filename = `${projectFolder}${fileRelativePath}`
const input = fs.readFileSync(filename).toString()
const babelPluginMap = {
  "transform-block-scoping": [transformBlockScoping],
}

;(async () => {
  const actual = await compileJs({
    input,
    filename,
    fileRelativePath,
    projectFolder: testFolder,
    babelPluginMap,
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
