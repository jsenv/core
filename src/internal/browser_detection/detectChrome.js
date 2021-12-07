import { userAgentToVersion, firstMatch } from "./util.js"

export const detectChrome = () => {
  const { userAgentData } = window.navigator
  if (userAgentData) {
    const brand = userAgentData.brands.some((brand) => {
      return brand.brand === "chromium" || brand.brand === "Google Chrome"
    })
    if (brand) {
      return {
        name: "chrome",
        version: brand.version,
      }
    }
  }
  return userAgentToBrowser(window.navigator.userAgent)
}

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
      version: firstMatch(
        /(?:chrome|crios|crmo)\/(\d+(\.?_?\d+)+)/i,
        userAgent,
      ),
    }
  }

  return null
}
