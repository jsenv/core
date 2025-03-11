import { firstMatch } from "./util.js"

export const detectAndroid = () => navigatorToBrowser(window.navigator)

const navigatorToBrowser = ({ userAgent, appVersion }) => {
  if (/(android)/i.test(userAgent)) {
    return {
      name: "android",
      version: firstMatch(/Android (\d+(\.?_?\d+)+)/i, appVersion),
    }
  }
  return null
}
