import { memoize } from "@jsenv/filesystem"

const FEATURE_DETECT_DYNAMIC_IMPORT_FILE_URL = new URL(
  "./feature_detect_top_level_await.mjs",
  import.meta.url,
).href

export const nodeSupportsTopLevelAwait = memoize(async () => {
  try {
    const namespace = await import(FEATURE_DETECT_DYNAMIC_IMPORT_FILE_URL)
    const supported = namespace.default === 42
    return supported
  } catch (e) {
    return false
  }
})
