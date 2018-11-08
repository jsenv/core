import { firstMatch } from "./util.js"

const navigatorToBrowser = ({ userAgent, appVersion }) => {
  if (/iPhone;/.test(userAgent)) {
    return {
      name: "ios",
      version: firstMatch(/OS (\d+(\.?_?\d+)+)/i, appVersion),
    }
  }
  if (/iPad;/.test(userAgent)) {
    return {
      name: "ios",
      version: firstMatch(/OS (\d+(\.?_?\d+)+)/i, appVersion),
    }
  }
  return null
}

export const detect = () => navigatorToBrowser(window.navigator)
