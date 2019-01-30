import {
  createCancellationSource,
  createCancellationToken,
  cancellationTokenCompose,
} from "@dmail/cancellation"
import { executePlan } from "../executePlan/index.js"
import { coverageMapCompose } from "./coverageMapCompose.js"
import { fileToEmptyCoverage } from "./fileToEmptyCoverage.js"

export const executionPlanToCoverageMap = async (
  executionPlan,
  {
    cancellationToken = createCancellationToken(),
    localRoot,
    filesToCover = [],
    cancelSIGINT = true,
    logProgression = true,
    logSummary = true,
  },
) => {
  // I think it is an error, it would be strange, for a given file
  // to be both covered and executed
  ensureNoFileIsBothCoveredAndExecuted({ filesToCover, executionPlan })

  if (cancelSIGINT) {
    const SIGINTCancelSource = createCancellationSource()
    process.on("SIGINT", () => SIGINTCancelSource.cancel("process interruption"))
    cancellationToken = cancellationTokenCompose(cancellationToken, SIGINTCancelSource.token)
  }

  const allExecutionResult = await executePlan(executionPlan, {
    cancellationToken,
    cover: true,
    cancelSIGINT: false, // already handled by this one
    afterEach: ({ file, platformName, status, capturedConsole }) => {
      if (!logProgression) return
      if (status === "passed") {
        console.log(createPassedLog({ file, platformName, status, capturedConsole }))
        return
      }
      if (status === "errored") {
        console.log(createErroredLog({ file, platformName, status, capturedConsole }))
        return
      }
      // missing timedout and disconnected
    },
  })
  if (logSummary) {
    console.log(createSummaryLog({ executionPlan, executionResult: allExecutionResult }))
  }

  const coverageMapArray = []
  Object.keys(allExecutionResult).forEach((file) => {
    const allExecutionResultForFile = allExecutionResult[file]
    Object.keys(allExecutionResultForFile).forEach((executionName) => {
      const executionResult = allExecutionResultForFile[executionName]
      if (!executionResult.status === "completed") return
      const { coverageMap } = executionResult.value
      if (!coverageMap) return
      coverageMapArray.push(coverageMap)
    })
  })
  const executionCoverageMap = coverageMapCompose(...coverageMapArray)

  const filesMissed = filesToCover.filter((file) => file in executionCoverageMap === false)

  const missedCoverageMap = {}
  await Promise.all(
    filesMissed.map(async (file) => {
      const emptyCoverage = await fileToEmptyCoverage(file, { cancellationToken, localRoot })
      missedCoverageMap[file] = emptyCoverage
      return emptyCoverage
    }),
  )

  const fullCoverageMap = {
    ...executionCoverageMap,
    ...missedCoverageMap,
  }

  // all file in the executionPlan must not be in the coverage object
  // we could also ensure that by not instrumenting theses files
  // but it's way more simple to instrument everything under
  // instrumented folder and exclude them from coverage here
  const coverageMap = {}
  Object.keys(fullCoverageMap).forEach((file) => {
    if (file in executionPlan) return

    // oh yeah we should also exclude node_modules files
    coverageMap[file] = fullCoverageMap[file]
  })

  return coverageMap
}

const createPassedLog = ({ file, capturedConsole, platformName }) => {
  const green = "\x1b[32m"
  const checkmark = "✔" // "\u2714"
  const close = "\x1b[0m"

  return `${green}${checkmark} ${file}${close}
----------- console ----------
${capturedConsole}
------------------------------
platform: "${platformName}"
status: "passed"
`
}

const createErroredLog = ({ file, capturedConsole, platformName }) => {
  const red = "\x1b[31m"
  const cross = "☓" // "\u2613"
  const close = "\x1b[0m"

  return `${red}${cross} ${file}${close}
----------- console ----------
${capturedConsole}
------------------------------
platform: "${platformName}"
status: "errored"
`
}

const createSummaryLog = ({ executionResult }) => {
  const fileNames = Object.keys(executionResult)
  const executionCount = fileNames.reduce((previous, fileName) => {
    return previous + Object.keys(executionResult[fileName]).length
  }, 0)

  const countResultMatching = (predicate) => {
    fileNames.reduce((previous, fileName) => {
      const fileExecutionResult = executionResult[fileName]

      return (
        previous +
        Object.keys(fileExecutionResult).filter((platformName) => {
          const fileExecutionResultForPlatform = fileExecutionResult[platformName]
          return predicate(fileExecutionResultForPlatform)
        }).length
      )
    }, 0)
  }

  const completedCount = countResultMatching(({ status }) => status === "completed")
  const erroredCount = countResultMatching(({ status }) => status === "errored")
  const timedoutCount = countResultMatching(({ status }) => status === "timedout")
  const disconnectedCount = countResultMatching(({ status }) => status === "disconnected")

  const close = "\x1b[0m"
  const red = "\x1b[31m"
  const green = "\x1b[32m"
  const yellow = "\x1b[33m"
  // const blue = "\x1b[34m"
  const magenta = "\x1b[35m"

  return `------ execution summary ---------
${executionCount} file execution launched
- ${yellow}${disconnectedCount} disconnected${close}
- ${red}${erroredCount} errored${close}
- ${magenta}${timedoutCount} timedout${close}
- ${green}${completedCount} completed${close}
----------------------------------`
}

const ensureNoFileIsBothCoveredAndExecuted = ({ filesToCover, executionPlan }) => {
  const fileToExecuteAndCover = filesToCover.find((file) => file in executionPlan)
  if (fileToExecuteAndCover)
    throw new Error(`${fileToExecuteAndCover} must be covered but is also part of execution plan`)
}
