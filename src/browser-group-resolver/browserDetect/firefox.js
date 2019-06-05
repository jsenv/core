import { firstMatch } from "./util.js"

const userAgentToBrowser = (userAgent) => {
  if (/firefox|iceweasel|fxios/i.test(userAgent)) {
    return {
      name: "firefox",
      version: firstMatch(/(?:firefox|iceweasel|fxios)[\s/](\d+(\.?_?\d+)+)/i, userAgent),
    }
  }
  return null
}

export const detect = () => userAgentToBrowser(window.navigator.userAgent)
