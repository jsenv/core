import { performance } from "node:perf_hooks"

export const timeStart = (name) => {
  // as specified in https://w3c.github.io/server-timing/#the-performanceservertiming-interface
  // duration is a https://www.w3.org/TR/hr-time-2/#sec-domhighrestimestamp
  const startTimestamp = performance.now()
  const timeEnd = () => {
    const endTimestamp = performance.now()
    const timing = {
      [name]: endTimestamp - startTimestamp,
    }
    return timing
  }
  return timeEnd
}

export const timeFunction = (name, fn) => {
  const timeEnd = timeStart(name)
  const returnValue = fn()
  if (returnValue && typeof returnValue.then === "function") {
    return returnValue.then((value) => {
      return [timeEnd(), value]
    })
  }
  return [timeEnd(), returnValue]
}
