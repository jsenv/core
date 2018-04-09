import { createAction, passed } from "@dmail/action"

const createExecutionQueue = () => {
  const pendings = []
  let running = false

  const enqueue = (fn, ...args) => {
    if (running) {
      const action = createAction()
      pendings.push({ action, fn, ...args })
      return action
    }
    running = true
    const action = passed(fn(...args))
    action.then(() => {
      running = false
      if (pendings.length > 0) {
        const { action, fn, ...args } = pendings.shift()
        action.pass(enqueue(fn, ...args))
      }
    })
    return action
  }

  return enqueue
}

export const enqueueCall = (fn) => {
  const enqueue = createExecutionQueue()
  return (...args) => enqueue(fn, ...args)
}

export const enqueueCallByArgs = ({ fn, restoreByArgs, memoizeArgs }) => (...args) => {
  const memoizedEnqueue = restoreByArgs(...args)
  if (memoizedEnqueue) {
    return memoizedEnqueue(fn, ...args)
  }
  const enqueue = createExecutionQueue()
  memoizeArgs(...args, enqueue)
  return enqueue(fn, ...args)
}
