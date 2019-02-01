import { assert } from "@dmail/assert"
import transformModulesSystemJs from "../../../babel-plugin-transform-modules-systemjs/index.js"
import { localRoot } from "../../../localRoot.js"
import { executeFile } from "../../../executeFile.js"
import { launchNode } from "../../launchNode.js"

const file = `src/launchNode/test/import-meta-url/import-meta-url.js`
const compileInto = "build"
const pluginMap = {
  "transform-modules-systemjs": [transformModulesSystemJs, { topLevelAwait: true }],
}

;(async () => {
  const actual = await executeFile(file, {
    localRoot,
    compileInto,
    pluginMap,
    launchPlatform: launchNode,
    platformTypeForLog: "node process",
    verbose: true,
    mirrorConsole: true,
    collectNamespace: true,
    port: 4500,
  })
  const expected = {
    status: "completed",
    coverageMap: undefined,
    namespace: {
      default:
        "http://127.0.0.1:4500/build/best/src/launchNode/test/import-meta-url/import-meta-url.js",
    },
  }
  assert({ actual, expected })
})()
