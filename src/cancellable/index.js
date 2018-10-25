// KEEP THIS IN MIND:
// when promise resolve before cancelling
// cancelling could be considered useless
// and calling cancel do nothing
// but we also use cancel as a cleaning mecanism
// so calling cancel() even if the task is done
// must call the cancellingTasks

const canHaveProperty = (value) =>
  value && (typeof value === "object" || typeof value === "function")

// const valuePropertyToThenable = (value, property) => {
//   if (!canHaveProperty(value)) {
//     return false
//   }
//   const propertyValue = value[property]
//   if (!canHaveProperty(propertyValue)) {
//     return false
//   }
//   if (!"then" in propertyValue) {
//     return false
//   }
//   const then = propertyValue.then
//   if (typeof then !== "function") {
//     return false
//   }
//   return propertyValue
// }

const valuePropertyToFunction = (value, property) => {
  if (!canHaveProperty(value)) {
    return false
  }
  if (!property in value) {
    return false
  }
  const propertyValue = value[property]
  if (typeof propertyValue !== "function") {
    return false
  }
  return propertyValue
}

export const createCancellable = () => {
  let cancelCalled = false
  let cancelCalledWith
  let cancelResolving = false

  let cancellingResolve
  const cancelling = new Promise((resolve) => {
    cancellingResolve = resolve
  })

  const callbacks = []
  const addCancellingTask = (callback) => {
    if (cancelResolving) {
      return () => {}
    }

    const index = callbacks.indexOf(callback)
    if (index === -1) {
      // add in reverse order because when using this api
      // you add more dependent cancelling task as you go
      // so we must cancel the more nested task first
      // and then cancel the higher level task
      callbacks.unshift(callback)
    }

    return () => {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 0, 1)
      }
    }
  }

  let cancelledResolve
  const cancelled = new Promise((resolve) => {
    cancelledResolve = resolve
  })

  let trackPromise = Promise.resolve()
  const cancel = (value) => {
    if (cancelCalled) {
      return cancelled
    }
    cancelCalled = true
    cancelCalledWith = value
    cancellingResolve(value)

    trackPromise.then(() => {
      const cancellingDonePromise = callbacks.reduce(
        (previous, callback) => previous.then(() => callback(value)),
        Promise.resolve(),
      )
      callbacks.length = 0
      cancelResolving = true
      cancelledResolve(cancellingDonePromise.then(() => value))
    })

    return cancelled
  }

  const map = (value) => {
    const promise = Promise.resolve(value)

    const infectPromise = (promise) => {
      // mais attend, a chaue fois aue j'infecte une promise elle doit ecouter
      // non pas son propre cancelCalled mais bien celui du parent
      // donc en gros comme le parent lui ne voit aue la valeur de retour
      // c'est l'enfant infecte a qui le parent doit pouvoir transmettre
      // que c'est lui qui le controle

      const promiseCancellable = new Promise((resolve, reject) => {
        trackPromise = new Promise((trackResolve) => {
          promise.then((value) => {
            const valueCancel = valuePropertyToFunction(value, "cancel")

            // if we called cancel() and value got a cancel method
            // await value.cancel() to cancel ourself
            if (cancelCalled && valueCancel) {
              trackResolve(valueCancel(cancelCalledWith))
            }

            // if we are not cancelling and value got a cancel method
            // register the value cancel method as a cancelling task to call
            // if we cancel() later
            if (cancelCalled === false && valueCancel) {
              addCancellingTask(valueCancel)
            }

            // if we are not cancelling, we can just resolve the trackPromise
            // so that calling cancel will take effect immediatly
            if (cancelCalled === false) {
              trackResolve(value)
            }

            // if we called cancel, the promise cannot resolve to prevent
            // code from being called
            if (cancelCalled === false) {
              resolve(value)
            }
          }, reject)
        })
      })

      const thenPure = promiseCancellable.then
      const thenInfected = function(...args) {
        return infectPromise(thenPure.apply(this, args))
      }
      promiseCancellable.then = thenInfected

      const catchPure = promiseCancellable.catch
      const catchInfected = function(...args) {
        return infectPromise(catchPure.apply(this, args))
      }
      promiseCancellable.catch = catchInfected

      // I gess we should infect finally ?
      promiseCancellable.cancel = cancel
      // promiseCancellable.cancelling = cancelling
      // promiseCancellable.cancelled = cancelled

      return promiseCancellable
    }

    return infectPromise(promise)
  }

  return {
    addCancellingTask,
    cancelling,
    cancel,
    cancelled,
    map,
  }
}
