import fs from "fs"
import { assert } from "@dmail/assert"
import { compileJs } from "../../compileJs.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")
const { projectFolder } = import.meta.require("../../../../jsenv.config.js")

const testFolder = `${projectFolder}/src/jsCompile/test/top-level-await`
const fileRelativePath = "/top-level-await.js"
const filename = `${testFolder}${fileRelativePath}`
const input = fs.readFileSync(filename).toString()
const babelConfigMap = {
  "transform-async-to-promises": [transformAsyncToPromises],
}

;(async () => {
  const { output } = await compileJs({
    input,
    filename,
    fileRelativePath,
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
