import { setANSIColor } from "../logs/log_style.js"
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
    return `all ${setANSIColor(`aborted`, EXECUTION_COLORS.aborted)}`
  }
  if (timedoutCount === executionCount) {
    return `all ${setANSIColor(`timed out`, EXECUTION_COLORS.timedout)}`
  }
  if (erroredCount === executionCount) {
    return `all ${setANSIColor(`errored`, EXECUTION_COLORS.errored)}`
  }
  if (completedCount === executionCount) {
    return `all ${setANSIColor(`completed`, EXECUTION_COLORS.completed)}`
  }
  if (cancelledCount === executionCount) {
    return `all ${setANSIColor(`cancelled`, EXECUTION_COLORS.cancelled)}`
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

  if (abortedCount) {
    parts.push(
      `${abortedCount} ${setANSIColor(`aborted`, EXECUTION_COLORS.aborted)}`,
    )
  }

  if (timedoutCount) {
    parts.push(
      `${timedoutCount} ${setANSIColor(
        `timed out`,
        EXECUTION_COLORS.timedout,
      )}`,
    )
  }

  if (erroredCount) {
    parts.push(
      `${erroredCount} ${setANSIColor(`errored`, EXECUTION_COLORS.errored)}`,
    )
  }

  if (completedCount) {
    parts.push(
      `${completedCount} ${setANSIColor(
        `completed`,
        EXECUTION_COLORS.completed,
      )}`,
    )
  }

  if (cancelledCount) {
    parts.push(
      `${cancelledCount} ${setANSIColor(
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
