import { secondMatch } from "./util.js"

export const detectEdge = () => userAgentToBrowser(window.navigator.userAgent)

const userAgentToBrowser = (userAgent) => {
  if (/edg([ea]|ios)/i.test(userAgent)) {
    return {
      name: "edge",
      version: secondMatch(/edg([ea]|ios)\/(\d+(\.?_?\d+)+)/i, userAgent),
    }
  }
  return null
}
