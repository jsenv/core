import { assert } from "@dmail/assert"
import { launchNode, cover } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/cover/import-map`
const compileInto = ".dist"
const importMap = {
  imports: {
    "/answer": "/answer.js",
  },
}

const { coverageMap: actual } = await cover({
  importMap,
  projectFolder: testFolder,
  compileInto,
  babelConfigMap: {},
  coverDescription: {
    "/file.js": true,
    "/answer.js": true,
  },
  executeDescription: {
    "/file.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
const expected = {
  "answer.js": actual["answer.js"],
  "file.js": actual["file.js"],
}
assert({
  actual,
  expected,
})
