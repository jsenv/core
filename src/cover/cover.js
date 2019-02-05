import { patternGroupToMetaMap, forEachRessourceMatching } from "@dmail/project-structure"
import { executePlan } from "../executePlan/index.js"
import { executionPlanResultToCoverageMap } from "../executionPlanResultToCoverageMap/index.js"
import { patternMappingToExecutionPlan } from "../patternMappingToExecutionPlan.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"

export const cover = catchAsyncFunctionCancellation(
  async ({ localRoot, compileInto, pluginMap, executePatternMapping, coverPatternMapping }) => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const [ressourcesToCover, executionPlanResult] = await Promise.all([
      listRessourcesToCover({ cancellationToken, localRoot, coverPatternMapping }),
      executeAndCoverPatternMapping({
        cancellationToken,
        localRoot,
        compileInto,
        pluginMap,
        patternMapping: executePatternMapping,
      }),
    ])

    const coverageMap = await executionPlanResultToCoverageMap(executionPlanResult, {
      cancellationToken,
      localRoot,
      filesToCover: ressourcesToCover,
    })

    return coverageMap
  },
)

const listRessourcesToCover = async ({ cancellationToken, localRoot, coverPatternMapping }) => {
  const coverMetaMap = patternGroupToMetaMap({
    cover: coverPatternMapping,
  })

  const ressources = await forEachRessourceMatching({
    cancellationToken,
    localRoot,
    metaMap: coverMetaMap,
    predicate: ({ cover }) => cover,
  })

  return ressources
}

const executeAndCoverPatternMapping = async ({
  cancellationToken,
  localRoot,
  compileInto,
  pluginMap,
  patternMapping,
}) => {
  const executionPlan = await patternMappingToExecutionPlan({
    cancellationToken,
    localRoot,
    compileInto,
    pluginMap,
    patternMapping,
  })

  const executionPlanResult = await executePlan(executionPlan, {
    cancellationToken,
    cover: true,
  })

  return executionPlanResult
}
