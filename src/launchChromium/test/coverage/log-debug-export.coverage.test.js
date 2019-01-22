import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { launchChromium } from "../../launchChromium.js"
import { executeFile } from "../../../executeFile.js"
import {
  coverageMapToAbsolute,
  coverageMapLog,
  coverageMapHTML,
} from "../../../executionPlanToCoverageMap/index.js"

const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})
const file = `src/launchChromium/test/fixtures/log-debug-export.js`
const compileInto = "build"

;(async () => {
  const actual = await executeFile(file, {
    localRoot,
    compileInto,
    pluginMap,
    launchPlatform: (options) =>
      launchChromium({
        headless: false,
        ...options,
      }),
    platformTypeForLog: "chromium browser",
    stopOnceExecuted: true,
    verbose: true,
    collectNamespace: true,
    collectCoverage: true,
  })
  const expected = {
    status: "completed",
    value: {
      namespace: { default: true },
      coverageMap: {
        "src/launchChromium/test/fixtures/log-debug-export.js":
          actual.value.coverageMap["src/launchChromium/test/fixtures/log-debug-export.js"],
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
