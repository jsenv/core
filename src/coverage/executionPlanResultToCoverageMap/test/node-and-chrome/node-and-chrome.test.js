import { assert } from "@dmail/assert"
import { launchChromium } from "@jsenv/chromium-launcher"
import { launchNode } from "../../../../node-launcher/index.js"
import { executePlan } from "../../../../executePlan/index.js"
import { startCompileServer } from "../../../../compile-server/index.js"
import { executionPlanResultToCoverageMap } from "../../executionPlanResultToCoverageMap.js"

const { projectPath } = import.meta.require("../../../../../jsenv.config.js")

const testFolder = `${projectPath}/src/cover/executionPlanResultToCoverageMap/test/node-and-chrome`
const compileInto = ".dist"

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectPath: testFolder,
    compileInto,
    protocol: "http",
    ip: "127.0.0.1",
    port: 0,
    logLevel: "off",
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
    projectPath,
    arrayOfpathnameRelativeToCover: [],
  })

  assert({
    actual: coverageMap,
    expected: {},
  })
})()
