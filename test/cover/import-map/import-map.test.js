import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { launchNode, cover } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const compileInto = ".dist"

const { coverageMap: actual } = await cover({
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
