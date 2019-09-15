import { userAgentToVersion } from "./util.js"

export const detectSafari = () => userAgentToBrowser(window.navigator.userAgent)

const userAgentToBrowser = (userAgent) => {
  if (/safari|applewebkit/i.test(userAgent)) {
    return {
      name: "safari",
      version: userAgentToVersion(userAgent),
    }
  }
  return null
}
