import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { launchNode } from "../../launchNode.js"
import { executeFile } from "../../../executeFile.js"

const file = `src/launchNode/test/alive/alive.js`
const compileInto = "build"
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

;(async () => {
  const actual = await executeFile(file, {
    launchPlatform: launchNode,
    localRoot,
    compileInto,
    pluginMap,
    platformTypeForLog: "node process",
    verbose: true,
    mirrorConsole: true,
    stopOnceExecuted: true,
  })
  const expected = {
    status: "completed",
    coverageMap: undefined,
    namespace: undefined,
  }
  assert({ actual, expected })
})()
