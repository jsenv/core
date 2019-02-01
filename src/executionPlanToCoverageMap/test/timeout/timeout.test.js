import { assert } from "@dmail/assert"
import transformModulesSystemJs from "../../../babel-plugin-transform-modules-systemjs/index.js"
import { launchNode } from "../../../launchNode/index.js"
import { executionPlanToCoverageMap } from "../../executionPlanToCoverageMap.js"
import { localRoot } from "../../../localRoot.js"
import { startCompileServer } from "../../../server-compile/index.js"

const filesToCover = []
const compileInto = "build"
const pluginMap = {
  "transform-modules-systemjs": [transformModulesSystemJs, {}],
}

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    localRoot,
    compileInto,
    pluginMap,
    protocol: "http",
    ip: "127.0.0.1",
    port: 0,
    verbose: false,
  })

  const nodeLaunch = () => launchNode({ remoteRoot, localRoot, compileInto })

  const executionPlan = {
    "src/executionPlanToCoverageMap/test/timeout/timeout.js": {
      node: {
        launch: nodeLaunch,
      },
    },
  }
  const coverageMap = await executionPlanToCoverageMap(executionPlan, {
    localRoot,
    compileInto,
    filesToCover,
  })

  // well, we can expect the coverage but the idea here is more to test executePlan
  // so let's move this to executePlan

  assert({
    actual: coverageMap,
    expected: {
      "src/executionPlanToCoverageMap/test/node-and-chrome/file.js": {
        ...coverageMap["src/executionPlanToCoverageMap/test/node-and-chrome/file.js"],
        s: { 0: 2, 1: 2, 2: 2 },
      },
      // we don't expect a coverage for node-and-chrome.js
    },
  })
})()
