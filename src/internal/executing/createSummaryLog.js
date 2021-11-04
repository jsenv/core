import { ANSI } from "@jsenv/log"

import { msAsDuration } from "../logs/msAsDuration.js"
import { EXECUTION_COLORS } from "./execution_colors.js"

export const createSummaryLog = (summary) => `
-------------- summary -----------------
${createSummaryMessage(summary)}${createTotalDurationMessage(summary)}
----------------------------------------
`

const createSummaryMessage = ({
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

  return `${executionCount} execution: ${createSummaryDetails({
    executionCount,
    abortedCount,
    timedoutCount,
    erroredCount,
    completedCount,
    cancelledCount,
  })}`
}

export const createSummaryDetails = ({
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

const createTotalDurationMessage = ({ startMs, endMs }) => {
  if (!endMs) return ""

  return `
total duration: ${msAsDuration(endMs - startMs)}`
}
