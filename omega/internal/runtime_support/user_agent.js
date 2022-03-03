import { require } from "#omega/internal/require.js"

export const parseUserAgentHeader = (userAgent) => {
  if (userAgent.includes("node-fetch/")) {
    // it's not really node and conceptually we can't assume the node version
    // but good enough for now
    return {
      runtimeName: "node",
      runtimeVersion: process.version.slice(1),
    }
  }
  // TODO: normalize user agent (chromium -> chrome for example)
  const useragent = require("@financial-times/useragent_parser")
  const { family, major, minor, patch } = useragent(userAgent)
  return {
    runtimeName: family.toLowerCase(),
    runtimeVersion:
      family === "Other" ? "unknown" : `${major}.${minor}${patch}`,
  }
}
