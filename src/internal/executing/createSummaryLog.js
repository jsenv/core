import {
  setANSIColor,
  ANSI_MAGENTA,
  ANSI_GREY,
  ANSI_YELLOW,
  ANSI_RED,
  ANSI_GREEN,
  ANSI_BLUE,
} from "../logs/log_style.js"
import { msAsDuration } from "../logs/msAsDuration.js"

const STATUS_COLORS = {
  disconnected: ANSI_MAGENTA,
  aborted: ANSI_BLUE,
  timedout: ANSI_YELLOW,
  errored: ANSI_RED,
  completed: ANSI_GREEN,
  cancelled: ANSI_GREY,
}

export const createSummaryLog = (summary) => `
-------------- summary -----------------
${createSummaryMessage(summary)}${createTotalDurationMessage(summary)}
----------------------------------------
`

const createSummaryMessage = ({
  executionCount,
  disconnectedCount,
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
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount,
    cancelledCount,
  })}`
}

export const createSummaryDetails = ({
  executionCount,
  disconnectedCount,
  abortedCount,
  timedoutCount,
  erroredCount,
  completedCount,
  cancelledCount,
}) => {
  if (disconnectedCount === executionCount) {
    return `all ${setANSIColor(`disconnected`, STATUS_COLORS.disconnected)}`
  }
  if (abortedCount === executionCount) {
    return `all ${setANSIColor(`aborted`, STATUS_COLORS.aborted)}`
  }
  if (timedoutCount === executionCount) {
    return `all ${setANSIColor(`timed out`, STATUS_COLORS.timedout)}`
  }
  if (erroredCount === executionCount) {
    return `all ${setANSIColor(`errored`, STATUS_COLORS.errored)}`
  }
  if (completedCount === executionCount) {
    return `all ${setANSIColor(`completed`, STATUS_COLORS.completed)}`
  }
  if (cancelledCount === executionCount) {
    return `all ${setANSIColor(`cancelled`, STATUS_COLORS.cancelled)}`
  }

  return createMixedDetails({
    executionCount,
    disconnectedCount,
    abortedCount,
    timedoutCount,
    erroredCount,
    completedCount,
    cancelledCount,
  })
}

const createMixedDetails = ({
  disconnectedCount,
  abortedCount,
  timedoutCount,
  erroredCount,
  completedCount,
  cancelledCount,
}) => {
  const parts = []

  if (disconnectedCount) {
    parts.push(
      `${disconnectedCount} ${setANSIColor(
        `disconnected`,
        STATUS_COLORS.disconnected,
      )}`,
    )
  }

  if (abortedCount) {
    parts.push(
      `${timedoutCount} ${setANSIColor(`aborted`, STATUS_COLORS.aborted)}`,
    )
  }

  if (timedoutCount) {
    parts.push(
      `${timedoutCount} ${setANSIColor(`timed out`, STATUS_COLORS.timedout)}`,
    )
  }

  if (erroredCount) {
    parts.push(
      `${erroredCount} ${setANSIColor(`errored`, STATUS_COLORS.errored)}`,
    )
  }

  if (completedCount) {
    parts.push(
      `${completedCount} ${setANSIColor(`completed`, STATUS_COLORS.completed)}`,
    )
  }

  if (cancelledCount) {
    parts.push(
      `${completedCount} ${setANSIColor(`cancelled`, STATUS_COLORS.cancelled)}`,
    )
  }

  return `${parts.join(", ")}`
}

const createTotalDurationMessage = ({ startMs, endMs }) => {
  if (!endMs) return ""

  return `
total duration: ${msAsDuration(endMs - startMs)}`
}
