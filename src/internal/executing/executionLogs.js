import {
  failureSignColorLess,
  okSignColorLess,
  setANSIColor,
  ANSI_GREY,
} from "../logs/log_style.js"
import { msAsDuration } from "../logs/msAsDuration.js"
import { EXECUTION_COLORS } from "./execution_colors.js"
import { createSummaryDetails } from "./createSummaryLog.js"

export const createExecutionResultLog = (
  { executionIndex, fileRelativeUrl, executionParams, executionResult },
  {
    completedExecutionLogAbbreviation,
    executionCount,
    timedoutCount,
    erroredCount,
    completedCount,
  },
) => {
  const executionNumber = executionIndex + 1
  const { status } = executionResult
  const { allocatedMs } = executionParams

  const description = descriptionFormatters[status]({
    executionNumber,
    executionCount,
    allocatedMs,
  })
  const summary = `(${createSummaryDetails({
    executionCount: executionNumber,
    timedoutCount,
    erroredCount,
    completedCount,
  })})`

  if (completedExecutionLogAbbreviation && status === "completed") {
    return `
${description} ${summary}`
  }

  const { runtimeName, runtimeVersion, consoleCalls, startMs, endMs, error } =
    executionResult

  const runtime = `${runtimeName}/${runtimeVersion}`
  return `
${description} ${summary}
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
    startMs,
    endMs,
  })}${appendConsole(consoleCalls)}${appendError(error, runtimeName)}`
}

const descriptionFormatters = {
  aborted: ({ executionNumber, executionCount }) => {
    return setANSIColor(
      `${failureSignColorLess} execution ${executionNumber} of ${executionCount} aborted`,
      EXECUTION_COLORS.aborted,
    )
  },
  timedout: ({ executionNumber, allocatedMs, executionCount }) => {
    return setANSIColor(
      `${failureSignColorLess} execution ${executionNumber} of ${executionCount} timeout after ${allocatedMs}ms`,
      EXECUTION_COLORS.timedout,
    )
  },
  errored: ({ executionNumber, executionCount }) => {
    return setANSIColor(
      `${failureSignColorLess} execution ${executionNumber} of ${executionCount} error`,
      EXECUTION_COLORS.errored,
    )
  },
  completed: ({ executionNumber, executionCount }) => {
    return setANSIColor(
      `${okSignColorLess} execution ${executionNumber} of ${executionCount} completed`,
      EXECUTION_COLORS.completed,
    )
  },
  cancelled: ({ executionNumber, executionCount }) => {
    return setANSIColor(
      `${failureSignColorLess} execution ${executionNumber} of ${executionCount} cancelled`,
      EXECUTION_COLORS.cancelled,
    )
  },
}

const appendDuration = ({ endMs, startMs }) => {
  if (!endMs) return ""

  return `
duration: ${msAsDuration(endMs - startMs)}`
}

const appendConsole = (consoleCalls) => {
  if (!consoleCalls || consoleCalls.length === 0) return ""

  const consoleOutput = consoleCalls.reduce((previous, { text }) => {
    return `${previous}${text}`
  }, "")

  const consoleOutputTrimmed = consoleOutput.trim()
  if (consoleOutputTrimmed === "") return ""

  return `
${setANSIColor(`-------- console --------`, ANSI_GREY)}
${consoleOutputTrimmed}
${setANSIColor(`-------------------------`, ANSI_GREY)}`
}

const appendError = (error, runtimeName) => {
  if (!error) {
    return ``
  }

  if (runtimeName === "webkit") {
    return `
error: ${error.message}
  at ${error.stack}`
  }

  return `
error: ${error.stack}`
}

// export const createShortExecutionResultLog = () => {
//   return `Execution completed (2/9) - (all completed)`
// }
