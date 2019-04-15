import fs from "fs"
import { assert } from "/node_modules/@dmail/assert/index.js"
import { jsCompile } from "../../jsCompile.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")
const { projectFolder } = import.meta.require("../../../../jsenv.config.js")

const testFolder = `${projectFolder}/src/jsCompile/test/top-level-await`
const filenameRelative = "top-level-await.js"
const filename = `${testFolder}/${filenameRelative}`
const input = fs.readFileSync(filename).toString()
const babelConfigMap = {
  "transform-async-to-promises": [transformAsyncToPromises],
}

;(async () => {
  const { output } = await jsCompile({
    input,
    filename,
    filenameRelative,
    projectFolder: testFolder,
    babelConfigMap,
  })
  const actual = output.indexOf("async function")
  const expected = -1
  assert({
    actual,
    expected,
  })
})()
