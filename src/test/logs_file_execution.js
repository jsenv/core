import {
  ANSI,
  UNICODE,
  msAsEllapsedTime,
  msAsDuration,
  byteAsMemoryUsage,
} from "@jsenv/log"

import { EXECUTION_COLORS } from "./execution_colors.js"

export const createExecutionLog = (
  {
    executionIndex,
    fileRelativeUrl,
    runtimeName,
    runtimeVersion,
    executionParams,
    executionResult,
    startMs,
    endMs,
  },
  {
    completedExecutionLogAbbreviation,
    counters,
    logRuntime,
    logEachDuration,
    timeEllapsed,
    memoryHeap,
  },
) => {
  const { status } = executionResult
  const descriptionFormatter = descriptionFormatters[status]
  const description = descriptionFormatter({
    index: executionIndex,
    total: counters.total,
    executionParams,
  })
  const summary = createIntermediateSummary({
    executionIndex,
    counters,
    timeEllapsed,
    memoryHeap,
  })
  if (completedExecutionLogAbbreviation && status === "completed") {
    return `${description}${summary}`
  }
  const { consoleCalls = [], error } = executionResult
  const consoleOutput = formatConsoleCalls(consoleCalls)
  return formatExecution({
    label: `${description}${summary}`,
    details: {
      file: fileRelativeUrl,
      ...(logRuntime ? { runtime: `${runtimeName}/${runtimeVersion}` } : {}),
      ...(logEachDuration
        ? {
            duration:
              status === "executing"
                ? msAsEllapsedTime(Date.now() - startMs)
                : msAsDuration(endMs - startMs),
          }
        : {}),
      ...(error
        ? { error: error.text || error.stack || error.message || error }
        : {}),
    },
    consoleOutput,
  })
}

export const createSummaryLog = (
  summary,
) => `-------------- summary -----------------
${createAllExecutionsSummary(summary)}
total duration: ${msAsDuration(summary.duration)}
----------------------------------------`

const createAllExecutionsSummary = ({ counters }) => {
  if (counters.total === 0) {
    return `no execution`
  }
  const executionLabel =
    counters.total === 1 ? `1 execution` : `${counters.total} executions`
  return `${executionLabel}: ${createStatusSummary({
    counters,
  })}`
}

const createIntermediateSummary = ({
  executionIndex,
  counters,
  memoryHeap,
  timeEllapsed,
}) => {
  const parts = []
  if (executionIndex > 0 || counters.done > 0) {
    parts.push(
      createStatusSummary({
        counters: {
          ...counters,
          total: executionIndex + 1,
        },
      }),
    )
  }
  if (timeEllapsed) {
    parts.push(`duration: ${msAsEllapsedTime(timeEllapsed)}`)
  }
  if (memoryHeap) {
    parts.push(`memory heap: ${byteAsMemoryUsage(memoryHeap)}`)
  }
  if (parts.length === 0) {
    return ""
  }
  return ` (${parts.join(` / `)})`
}

const createStatusSummary = ({ counters }) => {
  if (counters.aborted === counters.total) {
    return `all ${ANSI.color(`aborted`, EXECUTION_COLORS.aborted)}`
  }
  if (counters.timedout === counters.total) {
    return `all ${ANSI.color(`timed out`, EXECUTION_COLORS.timedout)}`
  }
  if (counters.errored === counters.total) {
    return `all ${ANSI.color(`errored`, EXECUTION_COLORS.errored)}`
  }
  if (counters.completed === counters.total) {
    return `all ${ANSI.color(`completed`, EXECUTION_COLORS.completed)}`
  }
  if (counters.cancelled === counters.total) {
    return `all ${ANSI.color(`cancelled`, EXECUTION_COLORS.cancelled)}`
  }
  return createMixedDetails({
    counters,
  })
}

const createMixedDetails = ({ counters }) => {
  const parts = []
  if (counters.timedout) {
    parts.push(
      `${counters.timedout} ${ANSI.color(
        `timed out`,
        EXECUTION_COLORS.timedout,
      )}`,
    )
  }
  if (counters.errored) {
    parts.push(
      `${counters.errored} ${ANSI.color(`errored`, EXECUTION_COLORS.errored)}`,
    )
  }
  if (counters.completed) {
    parts.push(
      `${counters.completed} ${ANSI.color(
        `completed`,
        EXECUTION_COLORS.completed,
      )}`,
    )
  }
  if (counters.aborted) {
    parts.push(
      `${counters.aborted} ${ANSI.color(`aborted`, EXECUTION_COLORS.aborted)}`,
    )
  }
  if (counters.cancelled) {
    parts.push(
      `${counters.cancelled} ${ANSI.color(
        `cancelled`,
        EXECUTION_COLORS.cancelled,
      )}`,
    )
  }
  return `${parts.join(", ")}`
}

const descriptionFormatters = {
  executing: ({ index, total }) => {
    return ANSI.color(
      `executing ${index + 1} of ${total}`,
      EXECUTION_COLORS.executing,
    )
  },
  aborted: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${index + 1} of ${total} aborted`,
      EXECUTION_COLORS.aborted,
    )
  },
  timedout: ({ index, total, executionParams }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${
        index + 1
      } of ${total} timeout after ${executionParams.allocatedMs}ms`,
      EXECUTION_COLORS.timedout,
    )
  },
  errored: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${index + 1} of ${total} errored`,
      EXECUTION_COLORS.errored,
    )
  },
  completed: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.OK_RAW} execution ${index + 1} of ${total} completed`,
      EXECUTION_COLORS.completed,
    )
  },
  cancelled: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${index + 1} of ${total} cancelled`,
      EXECUTION_COLORS.cancelled,
    )
  },
}

const formatConsoleCalls = (consoleCalls) => {
  if (consoleCalls.length === 0) {
    return ""
  }
  const repartition = {
    debug: 0,
    info: 0,
    warning: 0,
    error: 0,
    log: 0,
  }
  consoleCalls.forEach((consoleCall) => {
    repartition[consoleCall.type]++
  })
  const consoleOutput = formatConsoleOutput(consoleCalls)

  return `${ANSI.color(
    `-------- ${formatConsoleSummary(repartition)} --------`,
    ANSI.GREY,
  )}
${consoleOutput}
${ANSI.color(`-------------------------`, ANSI.GREY)}`
}

export const formatConsoleOutput = (consoleCalls) => {
  // inside Node.js you can do process.stdout.write()
  // and in that case the consoleCall is not suffixed with "\n"
  // we want to keep these calls together in the output
  const regroupedCalls = []
  consoleCalls.forEach((consoleCall, index) => {
    if (index === 0) {
      regroupedCalls.push(consoleCall)
      return
    }
    const previousCall = consoleCalls[index - 1]
    if (previousCall.type !== consoleCall.type) {
      regroupedCalls.push(consoleCall)
      return
    }
    if (previousCall.text.endsWith("\n")) {
      regroupedCalls.push(consoleCall)
      return
    }
    if (previousCall.text.endsWith("\r")) {
      regroupedCalls.push(consoleCall)
      return
    }
    const previousRegroupedCallIndex = regroupedCalls.length - 1
    const previousRegroupedCall = regroupedCalls[previousRegroupedCallIndex]
    previousRegroupedCall.text = `${previousRegroupedCall.text}${consoleCall.text}`
  })

  let consoleOutput = ``
  regroupedCalls.forEach((regroupedCall, index) => {
    const text = regroupedCall.text
    const textFormatted = prefixFirstAndIndentRemainingLines({
      prefix: CONSOLE_ICONS[regroupedCall.type],
      text,
      trimLastLine: index === regroupedCalls.length - 1,
    })
    consoleOutput += textFormatted
  })
  return consoleOutput
}

const prefixFirstAndIndentRemainingLines = ({ prefix, text, trimLastLine }) => {
  const lines = text.split(/\r?\n/)
  const firstLine = lines.shift()
  let result = `${prefix} ${firstLine}`
  let i = 0
  const indentation = `  `
  while (i < lines.length) {
    const line = lines[i].trim()
    i++
    result += line.length
      ? `\n${indentation}${line}`
      : trimLastLine && i === lines.length
      ? ""
      : `\n`
  }
  return result
}

const CONSOLE_ICONS = {
  debug: UNICODE.DEBUG,
  info: UNICODE.INFO,
  warning: UNICODE.WARNING,
  error: UNICODE.FAILURE,
  log: " ",
}

const formatConsoleSummary = (repartition) => {
  const { debug, info, warning, error } = repartition
  const parts = []
  if (error) {
    parts.push(`${CONSOLE_ICONS.error} ${error}`)
  }
  if (warning) {
    parts.push(`${CONSOLE_ICONS.warning} ${warning}`)
  }
  if (info) {
    parts.push(`${CONSOLE_ICONS.info} ${info}`)
  }
  if (debug) {
    parts.push(`${CONSOLE_ICONS.debug} ${debug}`)
  }
  if (parts.length === 0) {
    return `console`
  }
  return `console (${parts.join(" ")})`
}

const formatExecution = ({ label, details = {}, consoleOutput }) => {
  let message = ``
  message += label
  Object.keys(details).forEach((key) => {
    message += `
${key}: ${details[key]}`
  })
  if (consoleOutput) {
    message += `
${consoleOutput}`
  }
  return message
}
