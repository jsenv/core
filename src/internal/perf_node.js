import { performance } from "perf_hooks"

export const measureAsyncFnPerf = async (fn, name) => {
  const perfMarkStartName = `${name}_start`

  performance.mark(perfMarkStartName)
  try {
    const value = await fn()
    return value
  } finally {
    performance.measure(name, perfMarkStartName)
  }
}
