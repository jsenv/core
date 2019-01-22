import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { launchNode } from "../../launchNode.js"
import { executeFile } from "../../../executeFile.js"
import {
  coverageMapToAbsolute,
  coverageMapLog,
  coverageMapHTML,
} from "../../../executionPlanToCoverageMap/index.js"

const file = `src/launchNode/test/fixtures/log-debug-export.js`
const compileInto = "build"
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
  "transform-block-scoping": {},
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
    value: {
      namespace: { default: true },
      coverageMap: {
        "src/launchNode/test/fixtures/log-debug-export.js":
          actual.value.coverageMap["src/launchNode/test/fixtures/log-debug-export.js"],
      },
    },
  }
  assert({
    actual,
    expected,
  })

  const absoluteCoverageMap = coverageMapToAbsolute(actual.value.coverageMap, localRoot)
  coverageMapLog(absoluteCoverageMap)
  coverageMapHTML(absoluteCoverageMap)
})()
