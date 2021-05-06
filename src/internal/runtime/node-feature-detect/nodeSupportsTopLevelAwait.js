import { memoize, resolveUrl } from "@jsenv/util"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const featureDetetcTopLevelAwaitFileUrl = resolveUrl(
  "./src/internal/runtime/node-feature-detect/feature-detect-top-level-await.mjs",
  jsenvCoreDirectoryUrl,
)

export const nodeSupportsTopLevelAwait = memoize(async () => {
  try {
    const namespace = await import(featureDetetcTopLevelAwaitFileUrl)
    const supported = namespace.default === 42
    return supported
  } catch (e) {
    return false
  }
})
