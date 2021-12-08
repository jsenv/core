import { ANSI, UNICODE } from "@jsenv/log"

import { msAsDuration } from "../logs/msAsDuration.js"
import { EXECUTION_COLORS } from "./execution_colors.js"
import { createIntermediateSummary } from "./createSummaryLog.js"

export const formatExecuting = (
  { executionIndex },
  {
    executionCount,
    abortedCount,
    timedoutCount,
    erroredCount,
    completedCount,
    memoryHeap,
  },
) => {
  const executionNumber = executionIndex + 1
  const description = ANSI.color(
    `executing ${executionNumber} of ${executionCount}`,
    EXECUTION_COLORS.executing,
  )
  const summary =
    executionIndex === 0
      ? ""
      : `(${createIntermediateSummary({
          executionCount: executionIndex,
          abortedCount,
          timedoutCount,
          erroredCount,
          completedCount,
          memoryHeap,
        })})`

  return formatExecution({
    label: `${description} ${summary}`,
  })
}

export const formatExecutionResult = (
  {
    executionIndex,
    fileRelativeUrl,
    runtimeName,
    runtimeVersion,
    executionParams,
    executionResult,
  },
  {
    completedExecutionLogAbbreviation,
    executionCount,
    abortedCount,
    timedoutCount,
    erroredCount,
    completedCount,
    memoryHeap,
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

  const summary = `(${createIntermediateSummary({
    executionCount: executionNumber,
    abortedCount,
    timedoutCount,
    erroredCount,
    completedCount,
    memoryHeap,
  })})`

  if (completedExecutionLogAbbreviation && status === "completed") {
    return `${description} ${summary}`
  }

  const { consoleCalls = [], error, duration } = executionResult
  const console = formatConsoleCalls(consoleCalls)

  return formatExecution({
    label: `${description} ${summary}`,
    details: {
      file: fileRelativeUrl,
      runtime: `${runtimeName}/${runtimeVersion}`,
      duration: msAsDuration(duration),
      ...(error ? { error: error.stack } : {}),
    },
    console,
  })
}

const descriptionFormatters = {
  aborted: ({ executionNumber, executionCount }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${executionNumber} of ${executionCount} aborted`,
      EXECUTION_COLORS.aborted,
    )
  },
  timedout: ({ executionNumber, allocatedMs, executionCount }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${executionNumber} of ${executionCount} timeout after ${allocatedMs}ms`,
      EXECUTION_COLORS.timedout,
    )
  },
  errored: ({ executionNumber, executionCount }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${executionNumber} of ${executionCount} errored`,
      EXECUTION_COLORS.errored,
    )
  },
  completed: ({ executionNumber, executionCount }) => {
    return ANSI.color(
      `${UNICODE.OK_RAW} execution ${executionNumber} of ${executionCount} completed`,
      EXECUTION_COLORS.completed,
    )
  },
  cancelled: ({ executionNumber, executionCount }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${executionNumber} of ${executionCount} cancelled`,
      EXECUTION_COLORS.cancelled,
    )
  },
}

const formatConsoleCalls = (consoleCalls) => {
  const consoleOutput = consoleCalls.reduce((previous, { text }) => {
    return `${previous}${text}`
  }, "")

  const consoleOutputTrimmed = consoleOutput.trim()
  if (consoleOutputTrimmed === "") {
    return ""
  }

  return `${ANSI.color(`-------- console --------`, ANSI.GREY)}
${consoleOutputTrimmed}
${ANSI.color(`-------------------------`, ANSI.GREY)}`
}

const formatExecution = ({ label, details = {}, console }) => {
  let message = ``

  message += label
  Object.keys(details).forEach((key) => {
    message += `
${key}: ${details[key]}`
  })
  if (console) {
    message += `
${console}`
  }

  return message
}
