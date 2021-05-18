/* eslint-env browser */

const { performance } = window

export const measureAsyncFnPerf = performance
  ? async (fn, label) => {
      performance.mark(`${label} start`)
      try {
        const value = await fn()
        return value
      } finally {
        performance.mark(`${label} end`)
        performance.measure(label, `${label} start`, `${label} end`)
      }
    }
  : async (fn) => {
      return fn()
    }
