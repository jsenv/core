import { secondMatch } from "./util.js"

const userAgentToBrowser = (userAgent) => {
  if (/edg([ea]|ios)/i.test(userAgent)) {
    return {
      name: "edge",
      version: secondMatch(/edg([ea]|ios)\/(\d+(\.?_?\d+)+)/i, userAgent),
    }
  }
  return null
}

export const detect = () => userAgentToBrowser(window.navigator.userAgent)
