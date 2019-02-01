import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { executeFile } from "../../../executeFile.js"
import { launchNode } from "../../launchNode.js"

const file = `src/launchNode/test/syntax-error/syntax-error.js`
const compileInto = "build"
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

;(async () => {
  const actual = await executeFile(file, {
    localRoot,
    compileInto,
    pluginMap,
    launchPlatform: launchNode,
    platformTypeForLog: "node process",
    verbose: true,
    mirrorConsole: true,
  })
  const expected = {
    status: "errored",
    coverageMap: undefined,
    error: {
      code: "MODULE_PARSE_ERROR",
      message: actual.error.message,
      messageHTML: actual.error.messageHTML,
      stack: actual.error.stack,
      columnNumber: 14,
      fileName: "src/launchNode/test/syntax-error/syntax-error.js",
      lineNumber: 1,
    },
  }
  assert({ actual, expected })
})()
