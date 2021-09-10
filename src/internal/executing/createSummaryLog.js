import { setANSIColor, ANSI_MAGENTA, ANSI_YELLOW, ANSI_RED, ANSI_GREEN } from "../logs/log_style.js"
import { msAsDuration } from "../logs/msAsDuration.js"

export const createSummaryLog = (summary) => `
-------------- summary -----------------
${createSummaryMessage(summary)}${createTotalDurationMessage(summary)}
----------------------------------------
`

const createSummaryMessage = ({
  executionCount,
  disconnectedCount,
  timedoutCount,
  erroredCount,
  completedCount,
}) => {
  if (executionCount === 0) {
    return `0 execution`
  }

  return `${executionCount} execution: ${createSummaryDetails({
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount,
  })}`
}

export const createSummaryDetails = ({
  executionCount,
  disconnectedCount,
  timedoutCount,
  erroredCount,
  completedCount,
}) => {
  if (disconnectedCount === executionCount) {
    return createAllDisconnectedDetails()
  }
  if (timedoutCount === executionCount) {
    return createAllTimedoutDetails()
  }
  if (erroredCount === executionCount) {
    return createAllErroredDetails()
  }
  if (completedCount === executionCount) {
    return createAllCompletedDetails()
  }

  return createMixedDetails({
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount,
  })
}

const createAllDisconnectedDetails = () => `all ${setANSIColor(`disconnected`, ANSI_MAGENTA)}`

const createAllTimedoutDetails = () => `all ${setANSIColor(`timed out`, ANSI_YELLOW)}`

const createAllErroredDetails = () => `all ${setANSIColor(`errored`, ANSI_RED)}`

const createAllCompletedDetails = () => `all ${setANSIColor(`completed`, ANSI_GREEN)}`

const createMixedDetails = ({ disconnectedCount, timedoutCount, erroredCount, completedCount }) => {
  const parts = []

  if (disconnectedCount) {
    parts.push(`${disconnectedCount} ${setANSIColor(`disconnected`, ANSI_MAGENTA)}`)
  }

  if (timedoutCount) {
    parts.push(`${timedoutCount} ${setANSIColor(`timed out`, ANSI_YELLOW)}`)
  }

  if (erroredCount) {
    parts.push(`${erroredCount} ${setANSIColor(`errored`, ANSI_RED)}`)
  }

  if (completedCount) {
    parts.push(`${completedCount} ${setANSIColor(`completed`, ANSI_GREEN)}`)
  }

  return `${parts.join(", ")}`
}

const createTotalDurationMessage = ({ startMs, endMs }) => {
  if (!endMs) return ""

  return `
total duration: ${msAsDuration(endMs - startMs)}`
}
