import { memoize } from "@jsenv/util"

export const nodeSupportsTopLevelAwait = memoize(async () => {
  try {
    await import("./feature-detect-top-level-await.js")
    return true
  } catch (e) {
    return false
  }
})
