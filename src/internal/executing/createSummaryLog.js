import { setANSIColor, magenta, yellow, red, green } from "./ansi.js"
import { formatDuration } from "./formatDuration.js"

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

const createAllDisconnectedDetails = () => `all ${setANSIColor(`disconnected`, magenta)}`

const createAllTimedoutDetails = () => `all ${setANSIColor(`timed out`, yellow)}`

const createAllErroredDetails = () => `all ${setANSIColor(`errored`, red)}`

const createAllCompletedDetails = () => `all ${setANSIColor(`completed`, green)}`

const createMixedDetails = ({ disconnectedCount, timedoutCount, erroredCount, completedCount }) => {
  const parts = []

  if (disconnectedCount) {
    parts.push(`${disconnectedCount} ${setANSIColor(`disconnected`, magenta)}`)
  }

  if (timedoutCount) {
    parts.push(`${timedoutCount} ${setANSIColor(`timed out`, yellow)}`)
  }

  if (erroredCount) {
    parts.push(`${erroredCount} ${setANSIColor(`errored`, red)}`)
  }

  if (completedCount) {
    parts.push(`${completedCount} ${setANSIColor(`completed`, green)}`)
  }

  return `${parts.join(", ")}`
}

const createTotalDurationMessage = ({ startMs, endMs }) => {
  if (!endMs) return ""

  return `
total duration: ${formatDuration(endMs - startMs)}`
}
