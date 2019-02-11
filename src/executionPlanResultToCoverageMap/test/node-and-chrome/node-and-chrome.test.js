import { assert } from "@dmail/assert"
import { launchNode } from "../../../launchNode/index.js"
import { launchChromium } from "../../../launchChromium/index.js"
import { executePlan } from "../../../executePlan/index.js"
import { localRoot } from "../../../localRoot.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { executionPlanResultToCoverageMap } from "../../executionPlanResultToCoverageMap.js"

const filesToCover = []
const compileInto = "build"
const pluginMap = {}

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

  const nodeLaunch = (options) => launchNode({ ...options, remoteRoot, localRoot, compileInto })
  const chromiumLaunch = (options) =>
    launchChromium({ ...options, remoteRoot, localRoot, compileInto })

  const executionPlan = {
    "src/executionPlanResultToCoverageMap/test/node-and-chrome/node-and-chrome.js": {
      node: {
        launch: nodeLaunch,
      },
      chromium: {
        launch: chromiumLaunch,
      },
    },
  }

  const executionPlanResult = await executePlan(executionPlan, {
    cover: true,
  })

  const coverageMap = await executionPlanResultToCoverageMap(executionPlanResult, {
    localRoot,
    compileInto,
    filesToCover,
  })

  assert({
    actual: coverageMap,
    expected: {
      "src/executionPlanResultToCoverageMap/test/node-and-chrome/file.js": {
        ...coverageMap["src/executionPlanResultToCoverageMap/test/node-and-chrome/file.js"],
        s: { 0: 2, 1: 2, 2: 2 },
      },
      // we don't expect a coverage for node-and-chrome.js
    },
  })
})()
