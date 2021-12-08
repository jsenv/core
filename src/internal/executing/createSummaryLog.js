import { ANSI } from "@jsenv/log"

import { msAsDuration } from "../logs/msAsDuration.js"
import { formatByte } from "../logs/byte.js"
import { EXECUTION_COLORS } from "./execution_colors.js"

export const createSummaryLog = (
  summary,
) => `-------------- summary -----------------
${createAllExecutionsSummary(summary)}
total duration: ${msAsDuration(summary.duration)}
----------------------------------------`

const createAllExecutionsSummary = ({
  executionCount,
  abortedCount,
  timedoutCount,
  erroredCount,
  completedCount,
  cancelledCount,
}) => {
  if (executionCount === 0) {
    return `no execution`
  }

  const executionLabel =
    executionCount === 1 ? `1 execution` : `${executionCount} executions`
  return `${executionLabel}: ${createStatusSummary({
    executionCount,
    abortedCount,
    timedoutCount,
    erroredCount,
    completedCount,
    cancelledCount,
  })}`
}

export const createIntermediateSummary = ({
  executionCount,
  abortedCount,
  timedoutCount,
  erroredCount,
  completedCount,
  cancelledCount,
  memoryHeap,
}) => {
  let intermediateSummary = createStatusSummary({
    executionCount,
    abortedCount,
    timedoutCount,
    erroredCount,
    completedCount,
    cancelledCount,
  })

  if (memoryHeap) {
    intermediateSummary += ` / memory heap: ${formatByte(memoryHeap)}`
  }

  return intermediateSummary
}

const createStatusSummary = ({
  executionCount,
  abortedCount,
  timedoutCount,
  erroredCount,
  completedCount,
  cancelledCount,
}) => {
  if (abortedCount === executionCount) {
    return `all ${ANSI.color(`aborted`, EXECUTION_COLORS.aborted)}`
  }
  if (timedoutCount === executionCount) {
    return `all ${ANSI.color(`timed out`, EXECUTION_COLORS.timedout)}`
  }
  if (erroredCount === executionCount) {
    return `all ${ANSI.color(`errored`, EXECUTION_COLORS.errored)}`
  }
  if (completedCount === executionCount) {
    return `all ${ANSI.color(`completed`, EXECUTION_COLORS.completed)}`
  }
  if (cancelledCount === executionCount) {
    return `all ${ANSI.color(`cancelled`, EXECUTION_COLORS.cancelled)}`
  }

  return createMixedDetails({
    executionCount,
    abortedCount,
    timedoutCount,
    erroredCount,
    completedCount,
    cancelledCount,
  })
}

const createMixedDetails = ({
  abortedCount,
  timedoutCount,
  erroredCount,
  completedCount,
  cancelledCount,
}) => {
  const parts = []

  if (timedoutCount) {
    parts.push(
      `${timedoutCount} ${ANSI.color(`timed out`, EXECUTION_COLORS.timedout)}`,
    )
  }

  if (erroredCount) {
    parts.push(
      `${erroredCount} ${ANSI.color(`errored`, EXECUTION_COLORS.errored)}`,
    )
  }

  if (completedCount) {
    parts.push(
      `${completedCount} ${ANSI.color(
        `completed`,
        EXECUTION_COLORS.completed,
      )}`,
    )
  }

  if (abortedCount) {
    parts.push(
      `${abortedCount} ${ANSI.color(`aborted`, EXECUTION_COLORS.aborted)}`,
    )
  }

  if (cancelledCount) {
    parts.push(
      `${cancelledCount} ${ANSI.color(
        `cancelled`,
        EXECUTION_COLORS.cancelled,
      )}`,
    )
  }

  return `${parts.join(", ")}`
}
