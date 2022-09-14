import { memoizeByFirstArgument } from "@jsenv/utils/src/memoize/memoize_by_first_argument.js"

import { requireFromJsenv } from "@jsenv/core/src/require_from_jsenv.js"

export const parseUserAgentHeader = memoizeByFirstArgument((userAgent) => {
  if (userAgent.includes("node-fetch/")) {
    // it's not really node and conceptually we can't assume the node version
    // but good enough for now
    return {
      runtimeName: "node",
      runtimeVersion: process.version.slice(1),
    }
  }
  const UA = requireFromJsenv("@financial-times/polyfill-useragent-normaliser")
  const { ua } = new UA(userAgent)
  const { family, major, minor, patch } = ua
  return {
    runtimeName: family.toLowerCase(),
    runtimeVersion:
      family === "Other" ? "unknown" : `${major}.${minor}${patch}`,
  }
})
