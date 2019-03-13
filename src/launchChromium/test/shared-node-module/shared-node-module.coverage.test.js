import { assert } from "@dmail/assert"
import { root } from "../../../root.js"
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
const babelPluginDescription = {}

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    root,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: () => launchChromium({ root, compileInto, remoteRoot, headless: false }),
    stopOnceExecuted: true,
    mirrorConsole: true,
    collectNamespace: true,
    collectCoverage: true,
    file,
    verbose: true,
  })
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
