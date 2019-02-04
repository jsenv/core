import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"
import {
  coverageMapToAbsolute,
  coverageMapLog,
  coverageMapHTML,
} from "../../../executionPlanToCoverageMap/index.js"

const file = `src/launchChromium/test/shared-node-module/shared-node-module.js`
const compileInto = "build"
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    localRoot,
    compileInto,
    pluginMap,
  })

  const actual = await launchAndExecute(
    () => launchChromium({ localRoot, remoteRoot, compileInto, headless: false }),
    file,
    {
      platformTypeForLog: "chromium browser",
      verbose: true,
      stopOnceExecuted: true,
      mirrorConsole: true,
      collectNamespace: true,
      collectCoverage: true,
    },
  )
  const expected = {
    status: "completed",
    namespace: { foo: "foo" },
    coverageMap: {
      "src/launchChromium/test/shared-node-module/node_modules/foo/foo.js":
        actual.coverageMap["src/launchChromium/test/shared-node-module/node_modules/foo/foo.js"],
      "src/launchChromium/test/shared-node-module/node_modules/use-shared-foo/use-shared-foo.js":
        actual.coverageMap[
          "src/launchChromium/test/shared-node-module/node_modules/use-shared-foo/use-shared-foo.js"
        ],
      "src/launchChromium/test/shared-node-module/shared-node-module.js":
        actual.coverageMap["src/launchChromium/test/shared-node-module/shared-node-module.js"],
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
