import { assert } from "@dmail/assert"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"
import transformModulesSystemJs from "../../../babel-plugin-transform-modules-systemjs/index.js"
import { localRoot } from "../../../localRoot.js"
import { launchNode } from "../../launchNode.js"
import { executeFile } from "../../../executeFile.js"

const file = `src/launchNode/test/dynamic-import/dynamic-import.js`
const compileInto = "build"
const pluginMap = {
  "transform-modules-systemjs": [transformModulesSystemJs, { topLevelAwait: true }],
  "transform-async-to-promises": [transformAsyncToPromises],
}

;(async () => {
  const actual = await executeFile(file, {
    localRoot,
    compileInto,
    pluginMap,
    launchPlatform: launchNode,
    platformTypeForLog: "node process",
    verbose: true,
    collectNamespace: true,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 42,
    },
    coverageMap: undefined,
  }
  assert({ actual, expected })
})()
