const noop = () => {}

export const fork = (outcome, callback) => {
  let settled = false
  let cleaned = false
  let cleanup

  const returnValue = outcome((value) => {
    if (settled) return
    settled = true
    if (cleanup) cleanup()
    callback(value)
  })

  if (typeof returnValue === "function") {
    cleanup = () => {
      if (cleaned) return undefined
      cleaned = true
      return returnValue()
    }
  } else {
    cleanup = noop
  }

  // in case called sync
  if (settled) {
    cleanup()
  }

  return cleanup
}

export const forkPromise = (outcome, callback) => {
  return new Promise((resolve) => {
    fork(outcome, (value) => {
      resolve(callback(value))
    })
  })
}

export const labelize = (outcomeMap) => {
  const names = Object.keys(outcomeMap)

  return (settle) => {
    let cleanupMap = {}
    let called = false

    const visit = (name) => {
      const outcome = outcomeMap[name]
      const cleanup = fork(outcome, (value) => {
        called = true
        cleanupMap = undefined
        return settle({ name, value })
      })
      cleanupMap[name] = cleanup
    }

    let i = 0
    while (i < names.length) {
      const name = names[i]
      i++
      visit(name)
      if (called) break
    }

    return () => {
      Object.keys(cleanupMap).forEach((name) => {
        cleanupMap[name]()
      })
      cleanupMap = undefined
    }
  }
}

export const forkMatch = (outcome, callbackMap) => {
  return fork(outcome, ({ name, value }) => {
    if (name in callbackMap === false) {
      return undefined
    }

    const callback = callbackMap[name]
    if (typeof callback !== "function") {
      throw new TypeError(`${name} must be a function, got ${callback}`)
    }

    return callback(value)
  })
}
