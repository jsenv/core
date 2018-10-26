// var val = (function() {
//   var promise = new Promise(function(resolve) {
//     resolve(42)
//   })
//   promise.constructor = function(exec) {
//     exec(function() {}, function() {})
//   }
//   var FakePromise1 = promise.constructor
//   var FakePromise2 = function(exec) {
//     exec(function() {}, function() {})
//   }

//   FakePromise1[Symbol.species] = FakePromise2

//   return promise.then(function() {}) instanceof FakePromise2
// })()

// KEEP THIS IN MIND:
// when promise resolve before cancelling
// cancelling could be considered useless
// and calling cancel do nothing
// but we also use cancel as a cleaning mecanism
// so calling cancel() even if the task is done
// must call the cancellingTasks

const isThenable = (value) => {
  if (value) {
    return typeof value.then === "function"
  }
  return false
}

const isCancellable = (value) => {
  if (value) {
    return typeof value.cancel === "function"
  }
  return false
}

// as long as cancel is not called the main flow can go on
// as soon as cancel is called, we wait for the current promise to resolve (if any)
// and we call the callbacks
// further then must return a thenable pending forever

export const cancellable = (execute) => {
  let cancelling = false

  const cancelCallbacks = new Set()
  const cancelCallback = (callback) => {
    cancelCallbacks.add(callback)
  }

  const pipeCancel = (value) => {
    if (isCancellable(value)) {
      if (cancelling) {
        value.cancel()
      } else {
        cancelCallback(value.cancel)
      }
    }

    return value
  }

  const promise = new Promise((resolve) => {
    resolve(pipeCancel(execute({ cancelCallback })))
  })

  let cancelResolve
  const cancelPromise = new Promise((resolve) => {
    cancelResolve = resolve
  })

  const cancel = () => {
    if (cancelling) {
      return cancelPromise
    }
    cancelling = true

    promise.then(() => {
      const callbacks = Array.from(cancelCallbacks.values()).reverse()
      cancelCallbacks.clear()
      // faudrait appeler tous les callbacks etc
      cancelResolve(callbacks)
    })

    return cancelPromise
  }

  const then = (valueCallback, errorCallback) => {
    const thenPromise = new Promise((resolve, reject) => {
      promise.then((value) => {
        if (cancelling === false) {
          resolve(valueCallback ? pipeCancel(valueCallback(value)) : value)
        }
      }, errorCallback ? (error) => reject(errorCallback(error)) : reject)
    })
    return thenPromise
  }

  return {
    // [Symbol.species]: function () {}
    cancel,
    then,
  }
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
