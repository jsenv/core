import { require } from "../require.js"

// see also https://github.com/sindresorhus/execa/issues/96
export const killProcessTree = async (
  processId,
  { signal, timeout = 2000 },
) => {
  var pidtree = require("pidtree")

  let descendantProcessIds
  try {
    descendantProcessIds = await pidtree(processId)
  } catch (e) {
    if (e.message === "No matching pid found") {
      descendantProcessIds = []
    } else {
      throw e
    }
  }
  descendantProcessIds.forEach((descendantProcessId) => {
    try {
      process.kill(descendantProcessId, signal)
    } catch (error) {
      // ignore
    }
  })

  try {
    process.kill(processId, signal)
  } catch (e) {
    if (e.code !== "ESRCH") {
      throw e
    }
  }

  let remainingIds = [...descendantProcessIds, processId]

  const updateRemainingIds = () => {
    remainingIds = remainingIds.filter((remainingId) => {
      try {
        process.kill(remainingId, 0)
        return true
      } catch (e) {
        return false
      }
    })
  }

  let timeSpentWaiting = 0

  const check = async () => {
    updateRemainingIds()
    if (remainingIds.length === 0) {
      return
    }

    if (timeSpentWaiting > timeout) {
      const timeoutError = new Error(
        `timed out waiting for ${
          remainingIds.length
        } process to exit (${remainingIds.join(" ")})`,
      )
      timeoutError.code = "TIMEOUT"
      throw timeoutError
    }

    await new Promise((resolve) => setTimeout(resolve, 400))
    timeSpentWaiting += 400
    await check()
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
  await check()
}
