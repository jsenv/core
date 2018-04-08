import { createAction, passed } from "@dmail/action"

// a given function is forced to wait for any previous function call to be resolved
const createDebounceSelf = () => {
  const pendings = []
  let running = false

  const debounce = (fn) => {
    if (running === false) {
      const action = createAction()
      pendings.push({ action, fn })
      return action
    }
    running = true
    const action = passed(fn())
    action.then(() => {
      running = false
      if (pendings.length > 0) {
        const { action, fn } = pendings.shift()
        action.pass(debounce(fn))
      }
    })
    return action
  }

  return debounce
}

export const debounceSelf = (fn) => createDebounceSelf()(fn)

export const createDebounceSelfWithMemoize = ({ read, write }) => {
  const debounceMemoized = (...args) => {
    const debounceCached = read(...args)
    if (debounceCached) {
      return debounceCached
    }
    const debounceFresh = createDebounceSelf()
    write(...args, debounceFresh)
    return debounceFresh
  }

  return debounceMemoized
}
