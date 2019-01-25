import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { executeFile } from "../../../executeFile.js"
import { launchChromium } from "../../launchChromium.js"

const file = `src/launchChromium/test/fixtures/node_modules/use-scoped-answer/use-scoped-answer.js`
const compileInto = "build"
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

;(async () => {
  const actual = await executeFile(file, {
    localRoot,
    compileInto,
    pluginMap,
    launchPlatform: (options) => launchChromium({ headless: false, ...options }),
    platformTypeForLog: "chromium browser",
    verbose: true,
    stopOnceExecuted: true,
    collectNamespace: true,
  })
  const expected = {
    status: "completed",
    value: {
      namespace: {
        default: 43,
      },
    },
  }
  assert({ actual, expected })
})()
