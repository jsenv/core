import { patternGroupToMetaMap, forEachRessourceMatching } from "@dmail/project-structure"
import { executePlan } from "../executePlan/index.js"
import { executionPlanResultToCoverageMap } from "../executionPlanResultToCoverageMap/index.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"

export const cover = async ({
  root,
  compileInto,
  pluginMap,
  // coverDescription could be deduced from passing
  // an entryPointObject and collecting all dependencies
  // for now we stick to coverDescription using project-structure api
  coverDescription,
  executeDescription,
}) =>
  catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const [ressourcesToCover, executionPlanResult] = await Promise.all([
      listRessourcesToCover({ cancellationToken, root, coverDescription }),
      executeAndCoverPatternMapping({
        cancellationToken,
        root,
        compileInto,
        pluginMap,
        executeDescription,
      }),
    ])

    const coverageMap = await executionPlanResultToCoverageMap(executionPlanResult, {
      cancellationToken,
      localRoot: root,
      filesToCover: ressourcesToCover,
    })

    return coverageMap
  })

const listRessourcesToCover = async ({ cancellationToken, root, coverDescription }) => {
  const coverMetaMap = patternGroupToMetaMap({
    cover: coverDescription,
  })

  const ressources = await forEachRessourceMatching({
    cancellationToken,
    localRoot: root,
    metaMap: coverMetaMap,
    predicate: ({ cover }) => cover,
  })

  return ressources
}

const executeAndCoverPatternMapping = async ({
  cancellationToken,
  root,
  compileInto,
  pluginMap,
  executeDescription,
}) => {
  const executionPlan = await executeDescriptionToExecutionPlan({
    cancellationToken,
    root,
    compileInto,
    pluginMap,
    executeDescription,
  })

  const executionPlanResult = await executePlan(executionPlan, {
    cancellationToken,
    cover: true,
  })

  return executionPlanResult
}
