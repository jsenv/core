import { createRequire } from "node:module"

import { memoizeByFirstArgument } from "@jsenv/utils/memoize/memoize_by_first_argument.js"

const require = createRequire(import.meta.url)

export const parseUserAgentHeader = memoizeByFirstArgument((userAgent) => {
  if (userAgent.includes("node-fetch/")) {
    // it's not really node and conceptually we can't assume the node version
    // but good enough for now
    return {
      runtimeName: "node",
      runtimeVersion: process.version.slice(1),
    }
  }
  const UA = require("@financial-times/polyfill-useragent-normaliser")
  const { ua } = new UA(userAgent)
  const { family, major, minor, patch } = ua
  return {
    runtimeName: family.toLowerCase(),
    runtimeVersion:
      family === "Other" ? "unknown" : `${major}.${minor}${patch}`,
  }
})
