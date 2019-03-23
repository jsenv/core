import { assert } from "@dmail/assert"
import { projectFolder } from "../../../../projectFolder.js"
import { launchNode } from "../../../launchNode/index.js"
import { launchChromium } from "../../../launchChromium/index.js"
import { executePlan } from "../../../executePlan/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { executionPlanResultToCoverageMap } from "../../executionPlanResultToCoverageMap.js"

const testFolder = `${projectFolder}/src/executionPlanResultToCoverageMap/test/node-and-chrome`
const compileInto = ".dist"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelPluginDescription,
    protocol: "http",
    ip: "127.0.0.1",
    port: 0,
    verbose: false,
  })

  const nodeLaunch = (options) =>
    launchNode({ ...options, sourceOrigin, compileServerOrigin, compileInto })

  const chromiumLaunch = (options) =>
    launchChromium({ ...options, sourceOrigin, compileServerOrigin, compileInto })

  const executionPlan = {
    "node-and-chrome.js": {
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
    projectFolder,
    arrayOfFilenameRelativeToCover: [],
  })

  assert({
    actual: coverageMap,
    expected: {
      "file.js": {
        ...coverageMap["file.js"],
        s: { 0: 2, 1: 2, 2: 2 },
      },
      // we don't expect a coverage for node-and-chrome.js
    },
  })
})()
