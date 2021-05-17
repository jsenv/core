import { performance } from "perf_hooks"

export const measureAsyncFnPerf = async (fn, label) => {
  performance.mark(`${label} start`)
  try {
    const value = await fn()
    return value
  } finally {
    performance.mark(`${label} end`)
    performance.measure(label, `${label} start`, `${label} end`)
  }
}
