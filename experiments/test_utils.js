const results = []
const pendingPromiseSet = new Set()

window.executionPromise = (async () => {
  const documentReadyPromise = new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve()
      return
    }
    const loadCallback = () => {
      window.removeEventListener("load", loadCallback)
      resolve()
    }
    window.addEventListener("load", loadCallback)
  })
  // once document is ready, wait a timeout, if test still not called then we are done
  await documentReadyPromise
  await new Promise((resolve) => setTimeout(resolve))
  const waitPendingPromises = async () => {
    await Promise.all(Array.from(pendingPromiseSet))
    // new test added while the other where executing
    await new Promise((resolve) => setTimeout(resolve))
    if (pendingPromiseSet.size) {
      await waitPendingPromises()
    }
  }
  await waitPendingPromises()
  return results
})()

window.test = (description, callback) => {
  const testExecutionPromise = executeTest(description, callback)
  pendingPromiseSet.add(testExecutionPromise)
  testExecutionPromise.then(
    () => {
      pendingPromiseSet.delete(testExecutionPromise)
    },
    () => {
      pendingPromiseSet.delete(testExecutionPromise)
    },
  )
  return testExecutionPromise
}

const executeTest = async (description, callback) => {
  try {
    const value = await callback()
    results.push({ description, status: "completed", value })
  } catch (e) {
    results.push({ description, status: "failed", error: e })
  }
}
