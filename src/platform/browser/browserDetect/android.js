import { firstMatch } from "./util.js"

const navigatorToBrowser = ({ userAgent, appVersion }) => {
  if (/(android)/i.test(userAgent)) {
    return {
      name: "android",
      version: firstMatch(/Android (\d+(\.?_?\d+)+)/i, appVersion),
    }
  }
  return null
}

export const detect = () => navigatorToBrowser(window.navigator)
