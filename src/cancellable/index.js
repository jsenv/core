import { reduceToFirstOrPending } from "../promiseHelper.js"

export const createCancellable = () => {
  let cancellingPromiseResolved = false
  let cancellingResolve
  const cancelling = new Promise((resolve) => {
    cancellingResolve = (value) => {
      cancellingPromiseResolved = true
      resolve(value)
    }
  })

  const callbacks = []
  const addCancellingTask = (callback) => {
    if (cancellingPromiseResolved) {
      return () => {}
    }

    // add in reverse order because when using this api
    // you add more dependent cancelling task as you go
    // so we must cancel the more nested task first
    // and then cancel the higher level task
    callbacks.unshift(callback)

    return () => {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 0, 1)
      }
    }
  }

  let cancelledResolve
  const cancelled = new Promise((res) => {
    cancelledResolve = res
  })

  const cancel = (value) => {
    if (cancellingPromiseResolved) {
      return cancelled
    }
    cancellingResolve(value)

    cancelledResolve(
      callbacks
        .reduce((previous, callback) => previous.then(() => callback(value)), Promise.resolve())
        .then(() => value),
    )
    callbacks.length = 0

    return cancelled
  }

  const map = (value) => {
    if (
      value &&
      (typeof value === "object" || typeof value === "function") &&
      "cancel" in value &&
      typeof value.cancel === "function"
    ) {
      addCancellingTask(() => value.cancel)
    }

    // we infect promise so that then and catch still have the pointer to cancel
    const infectPromise = (promise) => {
      const thenPure = promise.then
      const thenInfected = function(...args) {
        return infectPromise(thenPure.apply(this, args))
      }
      promise.then = thenInfected

      const catchPure = promise.catch
      const catchInfected = function(...args) {
        return infectPromise(catchPure.apply(this, args))
      }
      promise.catch = catchInfected

      // maybe we should infect finally too

      promise.cancel = cancel

      return promise
    }

    return infectPromise(reduceToFirstOrPending([value, cancelling]))
  }

  return {
    addCancellingTask,
    cancelling,
    cancel,
    map,
  }
}
