import {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
} from "@dmail/project-structure"
import { executePlan } from "../executePlan/index.js"
import { executionPlanResultToCoverageMap } from "../executionPlanResultToCoverageMap/index.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"

export const cover = async ({
  importMap,
  projectFolder,
  compileInto,
  babelPluginDescription,
  // coverDescription could be deduced from passing
  // an entryPointsDescription and collecting all dependencies
  // for now we stick to coverDescription using project-structure api
  coverDescription,
  executeDescription,
}) =>
  catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const [arrayOfFilenameRelativeToCover, executionPlanResult] = await Promise.all([
      listFilesToCover({ cancellationToken, projectFolder, coverDescription }),
      executeAndCoverPatternMapping({
        cancellationToken,
        importMap,
        projectFolder,
        compileInto,
        babelPluginDescription,
        executeDescription,
      }),
    ])

    const coverageMap = await executionPlanResultToCoverageMap(executionPlanResult, {
      cancellationToken,
      projectFolder,
      arrayOfFilenameRelativeToCover,
    })

    return coverageMap
  })

const listFilesToCover = async ({ cancellationToken, projectFolder, coverDescription }) => {
  const metaDescriptionForCover = namedValueDescriptionToMetaDescription({
    cover: coverDescription,
  })

  const arrayOfFilenameRelativeToCover = await selectAllFileInsideFolder({
    cancellationToken,
    pathname: projectFolder,
    metaDescription: metaDescriptionForCover,
    predicate: ({ cover }) => cover,
    transformFile: ({ filenameRelative }) => filenameRelative,
  })

  return arrayOfFilenameRelativeToCover
}

const executeAndCoverPatternMapping = async ({
  cancellationToken,
  importMap,
  projectFolder,
  compileInto,
  babelPluginDescription,
  executeDescription,
}) => {
  const executionPlan = await executeDescriptionToExecutionPlan({
    cancellationToken,
    importMap,
    projectFolder,
    compileInto,
    babelPluginDescription,
    executeDescription,
  })

  const executionPlanResult = await executePlan(executionPlan, {
    cancellationToken,
    cover: true,
  })

  return executionPlanResult
}
