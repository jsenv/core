import { userAgentToVersion } from "./util.js"

const userAgentToBrowser = (userAgent) => {
  if (/safari|applewebkit/i.test(userAgent)) {
    return {
      name: "safari",
      version: userAgentToVersion(userAgent),
    }
  }
  return null
}

export const detect = () => userAgentToBrowser(window.navigator.userAgent)
