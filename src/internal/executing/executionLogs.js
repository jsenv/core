import { magenta, cross, yellow, green, checkmark, grey, red, ansiResetSequence } from "./ansi.js"
import { formatDuration } from "./formatDuration.js"
import { createSummaryDetails } from "./createSummaryLog.js"

export const createExecutionResultLog = (
  {
    status,
    fileRelativeUrl,
    allocatedMs,
    runtimeName,
    runtimeVersion,
    consoleCalls,
    startMs,
    endMs,
    error,
    executionIndex,
  },
  {
    completedExecutionLogAbbreviation,
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount,
  },
) => {
  const executionNumber = executionIndex + 1
  const summary = `(${createSummaryDetails({
    executionCount: executionNumber,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount,
  })})`

  const runtime = `${runtimeName}/${runtimeVersion}`

  if (status === "completed") {
    if (completedExecutionLogAbbreviation) {
      return `
${green}${checkmark} execution ${executionNumber} of ${executionCount} completed${ansiResetSequence} ${summary}.`
    }

    return `
${green}${checkmark} execution ${executionNumber} of ${executionCount} completed${ansiResetSequence} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
      startMs,
      endMs,
    })}${appendConsole(consoleCalls)}${appendError(error)}`
  }

  if (status === "disconnected") {
    return `
${magenta}${cross} execution ${executionNumber} of ${executionCount} disconnected${ansiResetSequence} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
      startMs,
      endMs,
    })}${appendConsole(consoleCalls)}${appendError(error)}`
  }

  if (status === "timedout") {
    return `
${yellow}${cross} execution ${executionNumber} of ${executionCount} timeout after ${allocatedMs}ms${ansiResetSequence} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
      startMs,
      endMs,
    })}${appendConsole(consoleCalls)}${appendError(error)}`
  }

  return `
${red}${cross} execution ${executionNumber} of ${executionCount} error${ansiResetSequence} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
    startMs,
    endMs,
  })}${appendConsole(consoleCalls)}${appendError(error)}`
}

const appendDuration = ({ endMs, startMs }) => {
  if (!endMs) return ""

  return `
duration: ${formatDuration(endMs - startMs)}`
}

const appendConsole = (consoleCalls) => {
  if (!consoleCalls || consoleCalls.length === 0) return ""

  const consoleOutput = consoleCalls.reduce((previous, { text }) => {
    return `${previous}${text}`
  }, "")

  const consoleOutputTrimmed = consoleOutput.trim()
  if (consoleOutputTrimmed === "") return ""

  return `
${grey}-------- console --------${ansiResetSequence}
${consoleOutputTrimmed}
${grey}-------------------------${ansiResetSequence}`
}

const appendError = (error) => {
  if (!error) return ``
  return `
error: ${error.stack}`
}

export const createShortExecutionResultLog = () => {
  return `Execution completed (2/9) - (all completed)`
}
