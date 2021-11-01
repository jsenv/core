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
      if (typeof process.emitWarning === "object") {
        process.emitWarning(`Trying to register same callback twice`, {
          CODE: "CALLBACK_DUPLICATION",
          detail: `It's often the sign that code is executd more than once`,
        })
      } else {
        console.warn(`Trying to add same callback twice`)
      }
    } else {
      callbacks = [...callbacks, callback]
    }

    return () => {
      remove(callback)
    }
  }

  const remove = (callback) => {
    callbacks = arrayWithout(callbacks, callback)
  }

  const clear = () => {
    callbacks = []
  }

  const copy = () => {
    return callbacks.slice()
  }

  return {
    add,
    remove,
    clear,
    copy,
  }
}

const arrayWithout = (array, item) => {
  if (array.length === 0) return array
  const arrayWithoutItem = []
  let i = 0
  while (i < array.length) {
    const value = array[i]
    i++
    if (value === item) {
      continue
    }
    arrayWithoutItem.push(value)
  }
  return arrayWithoutItem
}
