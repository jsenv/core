import { detect as ieDetect } from "./ie.js"
import { detect as operaDetect } from "./opera.js"
import { detect as edgeDetect } from "./edge.js"
import { detect as firefoxDetect } from "./firefox.js"
import { detect as chromeDetect } from "./chrome.js"
import { detect as safariDetect } from "./safari.js"
import { detect as electronDetect } from "./electron.js"
import { detect as iosDetect } from "./ios.js"

const detectorCompose = (detectors) => () => {
  let i = 0
  while (i < detectors.length) {
    const detector = detectors[i]
    i++
    const result = detector()
    if (result) {
      return result
    }
  }
  return null
}

const detector = detectorCompose([
  operaDetect,
  ieDetect,
  edgeDetect,
  firefoxDetect,
  chromeDetect,
  safariDetect,
  electronDetect,
  iosDetect,
])

const normalizeName = (name) => {
  return name.toLowerCase()
}

const normalizeVersion = (version) => {
  const parts = version.split(".")
  // remove extraneous .
  return parts.slice(0, 3).join(".")
}

export const detect = () => {
  const { name = "other", version = "unknown" } = detector() || {}

  return {
    name: normalizeName(name),
    version: normalizeVersion(version),
  }
}
