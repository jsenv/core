import parser from "ua-parser-js"

const getPlatformNameAndVersionFromUserAgent = (userAgent) => {
  if (userAgent.startsWith("node/")) {
    return {
      platformName: "node",
      platformVersion: userAgent.slice("node/".length),
    }
  }
  const data = parser(userAgent)
  return {
    platformName: data.browser.name,
    platformVersion: data.browser.version,
  }
}

export const getPlatformAndVersionFromHeaders = (headers) => {
  if ("user-agent" in headers) {
    return getPlatformNameAndVersionFromUserAgent(headers["user-agent"])
  }
  return {
    platformName: "unknown",
    platformVersion: "0",
  }
}
