import { createNodeSystem } from "@dmail/module-loader"

const memoize = (fn) => {
  let called = false
  let memoizedValue
  return (...args) => {
    if (called) {
      return memoizedValue
    }
    memoizedValue = fn(...args)
    called = true
    return memoizedValue
  }
}

export const ensureSystem = memoize((...args) => {
  return createNodeSystem(...args).then((nodeSystem) => {
    global.System = nodeSystem
    return nodeSystem
  })
})
