import { createAction, passed } from "@dmail/action"
import { memoizeSync, createStore } from "../memoize.js"

const createExecutionQueue = () => {
  const pendings = []
  let running = false

  const enqueue = (fn, ...args) => {
    if (running) {
      const action = createAction()
      pendings.push({ action, fn, args })
      return action
    }
    running = true
    const action = passed(fn(...args))
    const onPassedOrFailed = () => {
      running = false
      if (pendings.length > 0) {
        const { action, fn, args } = pendings.shift()
        action.pass(enqueue(fn, ...args))
      }
    }
    action.then(onPassedOrFailed, onPassedOrFailed)
    return action
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
