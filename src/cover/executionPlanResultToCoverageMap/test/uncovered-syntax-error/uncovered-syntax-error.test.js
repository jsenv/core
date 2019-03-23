import { assert } from "@dmail/assert"
import { projectFolder } from "../../../../../projectFolder.js"
import { executePlan } from "../../../../executePlan/index.js"
import { executionPlanResultToCoverageMap } from "../../executionPlanResultToCoverageMap.js"

const testFolder = `${projectFolder}/src/executionPlanResultToCoverageMap/test/uncovered-syntax-error`

;(async () => {
  const executionPlan = {}

  const executionPlanResult = await executePlan(executionPlan, {
    cover: true,
  })

  const coverageMap = await executionPlanResultToCoverageMap(executionPlanResult, {
    projectFolder: testFolder,
    arrayOfFilenameRelativeToCover: ["syntax-error.js"],
  })

  assert({
    actual: coverageMap,
    expected: {
      "syntax-error.js": {
        ...coverageMap["syntax-error.js"],
        s: {},
      },
    },
  })
})()
