import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { executeFile } from "../../../executeFile.js"
import { launchNode } from "../../launchNode.js"
import {
  coverageMapToAbsolute,
  coverageMapLog,
  coverageMapHTML,
} from "../../../executionPlanToCoverageMap/index.js"

const file = `src/launchNode/test/absolute-import/absolute-import.js`
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
    collectNamespace: true,
    collectCoverage: true,
    stopOnceExecuted: true,
  })
  const expected = {
    status: "completed",
    namespace: {
      default: 42,
    },
    coverageMap: {
      "src/launchNode/test/absolute-import/absolute-import.js":
        actual.coverageMap["src/launchNode/test/absolute-import/absolute-import.js"],
      "src/launchNode/test/absolute-import/dependency.js":
        actual.coverageMap["src/launchNode/test/absolute-import/dependency.js"],
    },
  }
  assert({
    actual,
    expected,
  })

  const absoluteCoverageMap = coverageMapToAbsolute(actual.coverageMap, localRoot)
  coverageMapLog(absoluteCoverageMap)
  coverageMapHTML(absoluteCoverageMap)
})()
