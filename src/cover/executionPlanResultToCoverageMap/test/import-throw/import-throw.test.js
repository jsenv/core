import { assert } from "@dmail/assert"
import { launchNode } from "../../../../node-launcher/index.js"
import { launchChromium } from "../../../../chromium-launcher/index.js"
import { executePlan } from "../../../../executePlan/index.js"
import { startCompileServer } from "../../../../compile-server/index.js"
import { executionPlanResultToCoverageMap } from "../../executionPlanResultToCoverageMap.js"

const { projectPath } = import.meta.require("../../../../../jsenv.config.js")

const testFolder = `${projectPath}/src/executionPlanResultToCoverageMap/test/import-throw`
const compileInto = ".dist"

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectPath: testFolder,
    compileInto,
    logLevel: "off",
  })

  const nodeLaunch = (options) =>
    launchNode({ ...options, sourceOrigin, compileServerOrigin, compileInto })

  const chromiumLaunch = (options) =>
    launchChromium({ ...options, sourceOrigin, compileServerOrigin, compileInto })

  const executionPlan = {
    "import-throw.js": {
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
    expected: {
      "throw.js": {
        ...coverageMap["throw.js"],
        s: { 0: 2, 1: 2 },
      },
    },
  })
})()
