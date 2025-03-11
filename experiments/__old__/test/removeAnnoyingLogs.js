export const removeAnnoyingLogs = (consoleCalls) => {
  return removeExperimentalWarnings(removeDebuggerLogs(consoleCalls))
}

const removeExperimentalWarnings = (consoleCalls) => {
  return consoleCalls.filter(({ text }) => {
    return !text.includes(" ExperimentalWarning: ")
  })
}

// we want to remove from logs the debugger output that looks like that
// Debugger listening on ws://127.0.0.1:23637/b9c3fcec-f347-40dc-852d-f64a4be2329e
// For help see https://nodejs.org/en/docs/inspector
// Debugger attached.
const removeDebuggerLogs = (consoleCalls) => {
  return consoleCalls.filter(({ text }) => {
    return (
      !text.includes(`Debugger listening on`) &&
      !text.includes("Debugger attached") &&
      !text.includes("Waiting for the debugger")
    )
  })
}
