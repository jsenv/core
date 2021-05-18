/* eslint-env browser */

const { performance } = window

export const measureAsyncFnPerf = performance
  ? async (fn, name) => {
      const perfMarkStartName = `${name}_start`

      performance.mark(perfMarkStartName)
      try {
        const value = await fn()
        return value
      } finally {
        performance.measure(name, perfMarkStartName)
      }
    }
  : async (fn) => {
      return fn()
    }
