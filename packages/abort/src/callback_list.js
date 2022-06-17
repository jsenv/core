export const createCallbackList = () => {
  let callbacks = []

  const add = (callback) => {
    if (typeof callback !== "function") {
      throw new Error(`callback must be a function, got ${callback}`)
    }

    // don't register twice
    const existingCallback = callbacks.find((callbackCandidate) => {
      return callbackCandidate === callback
    })
    if (existingCallback) {
      emitCallbackDuplicationWarning()
      return removeNoop
    }

    callbacks.push(callback)
    return () => {
      const index = callbacks.indexOf(callback)
      if (index === -1) {
        return
      }

      callbacks.splice(index, 1)
    }
  }

  const notify = (param) => {
    const values = callbacks.slice().map((callback) => {
      return callback(param)
    })
    return values
  }

  return {
    add,
    notify,
  }
}

const emitCallbackDuplicationWarning = () => {
  if (typeof process.emitWarning === "function") {
    process.emitWarning(`Trying to add a callback already in the list`, {
      CODE: "CALLBACK_DUPLICATION",
      detail: `Code is potentially executed more than it should`,
    })
  } else {
    console.warn(`Trying to add same callback twice`)
  }
}

const removeNoop = () => {}
