import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../localRoot.js"
import { launchChromium } from "../launchChromium.js"
import { executeFileOnPlatform } from "../../executeFileOnPlatform.js"

const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})
const file = `src/launchChromium/test/fixtures/file.js`
const compileInto = "build"

;(async () => {
  const result = await executeFileOnPlatform(
    file,
    (options) =>
      launchChromium({
        headless: false,
        ...options,
      }),
    {
      localRoot,
      compileInto,
      pluginMap,
      platformTypeForLog: "chromium browser",
      stopOnceExecuted: true,
      verbose: true,
      collectNamespace: true,
      collectCoverage: true,
    },
  )
  assert({
    actual: result,
    expected: {
      namespace: { default: true },
      coverageMap: {
        "src/launchChromium/test/fixtures/file.js":
          result.coverageMap["src/launchChromium/test/fixtures/file.js"],
      },
    },
  })
})()
