import { assert } from "/node_modules/@dmail/assert/index.js"
import { projectFolder } from "../../../../../projectFolder.js"
import { launchNode } from "../../../../launchNode/index.js"
import { launchChromium } from "../../../../launchChromium/index.js"
import { executePlan } from "../../../../executePlan/index.js"
import { startCompileServer } from "../../../../server-compile/index.js"
import { executionPlanResultToCoverageMap } from "../../executionPlanResultToCoverageMap.js"

const testFolder = `${projectFolder}/src/executionPlanResultToCoverageMap/test/import-throw`
const compileInto = ".dist"
const babelConfigMap = {}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelConfigMap,
    verbose: false,
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
    projectFolder,
    arrayOfFilenameRelativeToCover: [],
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
