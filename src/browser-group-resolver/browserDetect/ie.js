import { firstMatch } from "./util.js"

const userAgentToBrowser = (userAgent) => {
  if (/msie|trident/i.test(userAgent)) {
    return {
      name: "ie",
      version: firstMatch(/(?:msie |rv:)(\d+(\.?_?\d+)+)/i, userAgent),
    }
  }
  return null
}

export const detect = () => userAgentToBrowser(window.navigator.userAgent)
