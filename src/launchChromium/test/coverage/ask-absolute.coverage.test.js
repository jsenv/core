import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { executeFile } from "../../../executeFile.js"
import { launchChromium } from "../../launchChromium.js"
import {
  coverageMapToAbsolute,
  coverageMapLog,
  coverageMapHTML,
} from "../../../executionPlanToCoverageMap/index.js"

const file = `src/launchChromium/test/fixtures/ask-absolute.js`
const compileInto = "build"
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

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
    platformTypeForLog: "node process",
    verbose: true,
    collectNamespace: true,
    collectCoverage: true,
    stopOnceExecuted: true,
  })
  const expected = {
    status: "completed",
    value: {
      namespace: {},
      coverageMap: {
        "src/launchChromium/test/fixtures/ask-absolute.js":
          actual.value.coverageMap["src/launchChromium/test/fixtures/ask-absolute.js"],
        "src/launchChromium/test/fixtures/modules/ask.js":
          actual.value.coverageMap["src/launchChromium/test/fixtures/modules/ask.js"],
        "src/launchChromium/test/fixtures/modules/respond.js":
          actual.value.coverageMap["src/launchChromium/test/fixtures/modules/respond.js"],
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
