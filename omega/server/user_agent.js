import { require } from "#omega/internal/require.js"

export const parseUserAgentHeader = (userAgent) => {
  const useragent = require("@financial-times/useragent_parser")
  const { family, major, minor, patch } = useragent(userAgent)
  return {
    runtimeName: family,
    runtimeVersion: `${major}.${minor}${patch}`,
  }
}
