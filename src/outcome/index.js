// https://funfix.org/api/effect/classes/io.html
// https://funfix.org/api/exec/classes/future.html
// https://folktale.origamitower.com/api/v2.3.0/en/folktale.html
// could be named swithch ?

const noop = () => {}

const notifyDefault = (callbacks, value) => {
  callbacks.forEach((callback) => callback(value))
}

export const computeToOutcome = (compute, { notify = notifyDefault } = {}) => {
  let settled = false
  let value
  let cleaned = false
  let cleanup

  const callbackSet = new Set()

  const register = (callback) => {
    if (settled) {
      callback(value)
      return noop
    }

    callbackSet.add(callback)
    return () => {
      callbackSet.delete(callback)
    }
  }

  let notifyReturnValue
  const settle = (value) => {
    if (settled) return notifyReturnValue
    settled = true

    if (cleanup) cleanup()

    const callbacks = Array.from(callbackSet.values())
    callbackSet.clear()
    notifyReturnValue = notify(callbacks, value)
    return notifyReturnValue
  }

  const computeReturnValue = compute(settle)

  if (typeof computeReturnValue === "function") {
    cleanup = () => {
      if (cleaned) return undefined
      cleaned = true
      return computeReturnValue()
    }
  } else {
    cleanup = noop
  }

  // in case called sync
  if (settled) {
    cleanup()
  }

  const isSettled = () => settled

  return {
    isSettled,
    register,
    cleanup,
  }
}

export const computeRace = (...computes) => {
  return (settle) => {
    const outcomes = []
    let settled = false

    const visit = (i) => {
      const compute = computes[i]
      const outcome = computeToOutcome(compute)
      outcome.register((value) => {
        settled = true
        settle(value)
      })
      outcomes.push(outcome)
    }

    let i = 0
    while (i < outcomes.length) {
      visit(i++)
      if (settled) break
    }

    return () => {
      outcomes.forEach((outcome) => outcome.cleanup())
      outcomes.length = 0
    }
  }
}

export const outcomeMatch = (outcomeMap, reactionMap) => {
  const unregisters = []
  const names = Object.keys(outcomeMap)
  let unregistered = false

  const unregisterAll = () => {
    unregistered = true
    unregisters.forEach((unregister) => unregister())
    unregisters.length = 0
  }

  const visit = (i) => {
    const name = names[i]
    const outcome = outcomeMap[name]

    let callback
    if (name in reactionMap === false) {
      callback = unregisterAll
    } else {
      const reaction = reactionMap[name]
      if (typeof reaction === "function") {
        callback = (value) => {
          unregisterAll()
          reaction(value)
        }
      } else {
        callback = unregisterAll
      }
    }

    const unregister = outcome.register(callback)
    unregisters.push(unregister)
  }

  let i = 0
  while (i < names.length) {
    visit(i++)
    if (unregistered) break
  }

  return unregisterAll
}

export const outcomeToPromise = (outcome) => {
  return new Promise((resolve) => {
    outcome.register(resolve)
  })
}
