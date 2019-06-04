import { userAgentToVersion, firstMatch } from "./util.js"

const userAgentToBrowser = (userAgent) => {
  if (/chromium/i.test(userAgent)) {
    return {
      name: "chrome",
      version:
        firstMatch(/(?:chromium)[\s/](\d+(\.?_?\d+)+)/i, userAgent) ||
        userAgentToVersion(userAgent),
    }
  }

  if (/chrome|crios|crmo/i.test(userAgent)) {
    return {
      name: "chrome",
      version: firstMatch(/(?:chrome|crios|crmo)\/(\d+(\.?_?\d+)+)/i, userAgent),
    }
  }

  return null
}

export const detect = () => userAgentToBrowser(window.navigator.userAgent)
