import { magenta, yellow, red, green, ansiResetSequence } from "./ansi.js"
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
  if (executionCount === 0) return `0 execution.`

  return `${executionCount} execution: ${createSummaryDetails({
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount,
  })}.`
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

const createAllDisconnectedDetails = () => `all ${magenta}disconnected${ansiResetSequence}`

const createAllTimedoutDetails = () => `all ${yellow}timedout${ansiResetSequence}`

const createAllErroredDetails = () => `all ${red}errored${ansiResetSequence}`

const createAllCompletedDetails = () => `all ${green}completed${ansiResetSequence}`

const createMixedDetails = ({ disconnectedCount, timedoutCount, erroredCount, completedCount }) => {
  const parts = []

  if (disconnectedCount) {
    parts.push(`${disconnectedCount} ${magenta}disconnected${ansiResetSequence}`)
  }

  if (timedoutCount) {
    parts.push(`${timedoutCount} ${yellow}timed out${ansiResetSequence}`)
  }

  if (erroredCount) {
    parts.push(`${erroredCount} ${red}errored${ansiResetSequence}`)
  }

  if (completedCount) {
    parts.push(`${completedCount} ${green}completed${ansiResetSequence}`)
  }

  return `${parts.join(", ")}`
}

const createTotalDurationMessage = ({ startMs, endMs }) => {
  if (!endMs) return ""

  return `
total duration: ${formatDuration(endMs - startMs)}`
}
