/* eslint-disable import/max-dependencies */
import { normalizePathname } from "@jsenv/module-resolution"
import {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
  pathnameToMeta,
} from "@dmail/project-structure"
import { fileWrite } from "@dmail/helper"
import { executePlan } from "../executePlan/index.js"
import { executeDescriptionToExecutionPlan } from "../executeDescriptionToExecutionPlan.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { createInstrumentPlugin } from "./createInstrumentPlugin.js"
import { executionPlanResultToCoverageMap } from "./executionPlanResultToCoverageMap/index.js"
import { filenameRelativeToEmptyCoverage } from "./filenameRelativeToEmptyCoverage.js"
import { generateCoverageHTML } from "./generateCoverageHTML.js"
import { generateCoverageLog } from "./generateCoverageLog.js"

export const cover = async ({
  importMapFilenameRelative,
  projectFolder,
  coverageFilenameRelative,
  compileInto,
  compileGroupCount = 2,
  babelConfigMap,
  // coverDescription could be deduced from passing
  // an entryPointMap and collecting all dependencies
  // for now we stick to coverDescription using project-structure api
  coverDescription,
  executeDescription,
  defaultAllocatedMsPerExecution,
  enableGlobalLock = false,
  writeCoverageFile = true,
  logCoverageFilePath = true,
  logCoverageTable = false,
  writeCoverageHtmlFolder = false,
  updateProcessExitCode = true,
  throwUnhandled = true,
}) => {
  const start = async () => {
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

    const [{ planResult, planResultSummary }, arrayOfFilenameRelativeToCover] = await Promise.all([
      executeAndCoverPatternMapping({
        cancellationToken,
        importMapFilenameRelative,
        projectFolder,
        compileInto,
        compileGroupCount,
        babelConfigMap,
        executeDescription,
        coverFilePredicate,
        defaultAllocatedMsPerExecution,
        enableGlobalLock,
      }),
      listFilesToCover({
        cancellationToken,
        projectFolder,
        coverDescription,
      }),
    ])

    const executionCoverageMap = executionPlanResultToCoverageMap(planResult, {
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

    if (updateProcessExitCode) {
      if (planResultSummary.executionCount !== planResultSummary.completedCount) {
        process.exitCode = 1
      }
    }

    if (writeCoverageFile) {
      const coverageFilename = `${projectFolder}/${coverageFilenameRelative}`

      await fileWrite(coverageFilename, JSON.stringify(coverageMap, null, "  "))
      if (logCoverageFilePath) {
        console.log(`-> ${coverageFilename}`)
      }
    }

    if (logCoverageTable) {
      generateCoverageLog(coverageMap)
    }
    if (writeCoverageHtmlFolder) {
      generateCoverageHTML(coverageMap)
    }

    return {
      planResult,
      planResultSummary,
      coverageMap,
    }
  }

  const promise = catchAsyncFunctionCancellation(start)
  if (!throwUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}

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
  importMapFilenameRelative,
  projectFolder,
  compileInto,
  compileGroupCount,
  babelConfigMap,
  executeDescription,
  coverFilePredicate,
  defaultAllocatedMsPerExecution,
  enableGlobalLock,
}) => {
  const instrumentBabelPlugin = createInstrumentPlugin({
    predicate: (filenameRelative) => coverFilePredicate(filenameRelative),
  })

  const babelConfigMapWithInstrumentation = {
    ...babelConfigMap,
    "transform-instrument": [instrumentBabelPlugin],
  }

  const executionPlan = await executeDescriptionToExecutionPlan({
    cancellationToken,
    importMapFilenameRelative,
    projectFolder,
    compileInto,
    compileGroupCount,
    babelConfigMap: babelConfigMapWithInstrumentation,
    executeDescription,
    defaultAllocatedMsPerExecution,
    enableGlobalLock,
  })

  return executePlan(executionPlan, {
    cancellationToken,
    cover: true,
  })
}
