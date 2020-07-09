export const createCallbackList = () => {
  const callbackSet = new Set()

  const register = (callback) => {
    callbackSet.add(callback)
    return () => {
      callbackSet.delete(callback)
    }
  }

  const notify = (...args) => {
    callbackSet.forEach((callback) => {
      callback(...args)
    })
  }

  return {
    register,
    notify,
  }
}
