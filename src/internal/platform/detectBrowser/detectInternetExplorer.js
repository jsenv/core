import { firstMatch } from "./util.js"

export const detectInternetExplorer = () => userAgentToBrowser(window.navigator.userAgent)

const userAgentToBrowser = (userAgent) => {
  if (/msie|trident/i.test(userAgent)) {
    return {
      name: "ie",
      version: firstMatch(/(?:msie |rv:)(\d+(\.?_?\d+)+)/i, userAgent),
    }
  }
  return null
}
