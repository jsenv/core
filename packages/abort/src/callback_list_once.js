export const createCallbackListNotifiedOnce = () => {
  let callbacks = []
  let status = "waiting"
  let currentCallbackIndex = -1

  const callbackListOnce = {}

  const add = (callback) => {
    if (status !== "waiting") {
      emitUnexpectedActionWarning({ action: "add", status })
      return removeNoop
    }

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
      if (status === "notified") {
        // once called removing does nothing
        // as the callbacks array is frozen to null
        return
      }

      const index = callbacks.indexOf(callback)
      if (index === -1) {
        return
      }

      if (status === "looping") {
        if (index <= currentCallbackIndex) {
          // The callback was already called (or is the current callback)
          // We don't want to mutate the callbacks array
          // or it would alter the looping done in "call" and the next callback
          // would be skipped
          return
        }

        // Callback is part of the next callback to call,
        // we mutate the callbacks array to prevent this callback to be called
      }

      callbacks.splice(index, 1)
    }
  }

  const notify = (param) => {
    if (status !== "waiting") {
      emitUnexpectedActionWarning({ action: "call", status })
      return []
    }
    status = "looping"
    const values = callbacks.map((callback, index) => {
      currentCallbackIndex = index
      return callback(param)
    })
    callbackListOnce.notified = true
    status = "notified"
    // we reset callbacks to null after looping
    // so that it's possible to remove during the loop
    callbacks = null
    currentCallbackIndex = -1

    return values
  }

  callbackListOnce.notified = false
  callbackListOnce.add = add
  callbackListOnce.notify = notify

  return callbackListOnce
}

const emitUnexpectedActionWarning = ({ action, status }) => {
  if (typeof process.emitWarning === "function") {
    process.emitWarning(
      `"${action}" should not happen when callback list is ${status}`,
      {
        CODE: "UNEXPECTED_ACTION_ON_CALLBACK_LIST",
        detail: `Code is potentially executed when it should not`,
      },
    )
  } else {
    console.warn(
      `"${action}" should not happen when callback list is ${status}`,
    )
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
