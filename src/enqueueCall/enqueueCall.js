import { createStore, memoizeSync } from "../memoize.js"
import { createPromiseAndHooks } from "../promise.js"

const createExecutionQueue = () => {
  const pendings = []
  let running = false

  const enqueue = (fn, ...args) => {
    if (running) {
      const { promise, resolve, reject } = createPromiseAndHooks()
      pendings.push({ promise, resolve, reject, fn, args })
      return promise
    }
    running = true

    const onPassedOrFailed = () => {
      running = false
      if (pendings.length > 0) {
        const { resolve, fn, args } = pendings.shift()
        resolve(enqueue(fn, ...args))
      }
    }

    const promise = Promise.resolve(fn(...args))

    promise.then(onPassedOrFailed, onPassedOrFailed)

    return promise
  }

  return enqueue
}

export const enqueueCall = (fn) => {
  const enqueue = createExecutionQueue()
  return (...args) => enqueue(fn, ...args)
}

export const enqueueCallByArgs = (fn) => {
  return memoizeSync(
    createExecutionQueue,
    createStore({
      transform: (enqueue, ...args) => enqueue(fn, ...args),
    }),
  )
}
