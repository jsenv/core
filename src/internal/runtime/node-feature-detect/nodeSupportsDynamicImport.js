import { memoize } from "@jsenv/util"

export const nodeSupportsDynamicImport = memoize(async () => {
  try {
    await import("./feature-detect-dynamic-import.js")
    return true
  } catch (e) {
    return false
  }
})
