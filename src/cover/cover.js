import {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
  pathnameToMeta,
} from "@dmail/project-structure"
import { normalizePathname } from "@jsenv/module-resolution"
import { executePlan } from "../executePlan/index.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { createInstrumentPlugin } from "./createInstrumentPlugin.js"
import { executionPlanResultToCoverageMap } from "./executionPlanResultToCoverageMap/index.js"
import { filenameRelativeToEmptyCoverage } from "./filenameRelativeToEmptyCoverage.js"

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
    projectFolder = normalizePathname(projectFolder)
    const cancellationToken = createProcessInterruptionCancellationToken()
    const coverMetaDescription = namedValueDescriptionToMetaDescription({
      cover: coverDescription,
    })

    const coverFilePredicate = (filenameRelative) =>
      pathnameToMeta({
        pathname: `/${filenameRelative}`,
        metaDescription: coverMetaDescription,
      }).cover === true

    ensureNoFileIsBothCoveredAndExecuted({ executeDescription, coverFilePredicate })

    const [executionPlanResult, arrayOfFilenameRelativeToCover] = await Promise.all([
      executeAndCoverPatternMapping({
        cancellationToken,
        importMap,
        projectFolder,
        compileInto,
        babelPluginDescription,
        executeDescription,
        coverFilePredicate,
      }),
      listFilesToCover({
        cancellationToken,
        projectFolder,
        coverDescription,
      }),
    ])

    const executionCoverageMap = executionPlanResultToCoverageMap(executionPlanResult, {
      cancellationToken,
      projectFolder,
      arrayOfFilenameRelativeToCover,
    })

    const arrayOfFilenameRelativeMissingCoverage = arrayOfFilenameRelativeToCover.filter(
      (filenameRelative) => filenameRelative in executionCoverageMap === false,
    )

    const missedCoverageMap = {}
    await Promise.all(
      arrayOfFilenameRelativeMissingCoverage.map(async (filenameRelative) => {
        const emptyCoverage = await filenameRelativeToEmptyCoverage({
          cancellationToken,
          projectFolder,
          filenameRelative,
        })
        missedCoverageMap[filenameRelative] = emptyCoverage
        return emptyCoverage
      }),
    )

    const coverageMap = {
      ...executionCoverageMap,
      ...missedCoverageMap,
    }

    return coverageMap
  })

const ensureNoFileIsBothCoveredAndExecuted = ({ executeDescription, coverFilePredicate }) => {
  const fileToExecuteAndCoverArray = Object.keys(executeDescription).filter((filenameRelative) =>
    coverFilePredicate(filenameRelative),
  )
  if (fileToExecuteAndCoverArray.length) {
    // I think it is an error, it would be strange, for a given file
    // to be both covered and executed
    throw new Error(`some file must both be covered and executed.
file to execute and cover: ${fileToExecuteAndCoverArray}`)
  }
}

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
  coverFilePredicate,
}) => {
  const instrumentBabelPlugin = createInstrumentPlugin({
    predicate: (filenameRelative) => coverFilePredicate(filenameRelative),
  })

  const babelPluginDescriptionWithInstrumentation = {
    ...babelPluginDescription,
    "transform-instrument": [instrumentBabelPlugin],
  }

  const executionPlan = await executeDescriptionToExecutionPlan({
    cancellationToken,
    importMap,
    projectFolder,
    compileInto,
    babelPluginDescription: babelPluginDescriptionWithInstrumentation,
    executeDescription,
  })

  const executionPlanResult = await executePlan(executionPlan, {
    cancellationToken,
    cover: true,
  })

  return executionPlanResult
}
