import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { executeFile } from "../../../executeFile.js"
import { launchNode } from "../../launchNode.js"

const file = `src/launchNode/test/fixtures/ask-absolute.js`
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
    value: {
      namespace: {},
      coverageMap: {
        "src/launchNode/test/fixtures/node_modules/ask/ask.js":
          actual.value.coverageMap["src/launchNode/test/fixtures/node_modules/ask/ask.js"],
        "src/launchNode/test/fixtures/ask-absolute.js":
          actual.value.coverageMap["src/launchNode/test/fixtures/ask-absolute.js"],
      },
    },
  }
  // TODO:we are missing some coverage because instrumentation is not forwarded
  // for absolute dependency
  // we could create a specific System for instrumented code
  // or find a solution to avoid that
  // it could also avoid having to rewrite System.resolve for '/'
  // a possible fix could be to forward instrumeneted if parent is instrumented
  debugger
  assert({
    actual,
    expected,
  })
})()
