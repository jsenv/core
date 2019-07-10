// https://github.com/Ahmdrza/detect-browser/blob/26254f85cf92795655a983bfd759d85f3de850c6/detect-browser.js#L1
// https://github.com/lancedikson/bowser/blob/master/src/parser-browsers.js#L1

import { detect as androidDetect } from "./android.js"
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
  androidDetect,
])

export const detect = () => {
  const { name = "other", version = "unknown" } = detector() || {}

  return {
    name: normalizeName(name),
    version: normalizeVersion(version),
  }
}

const normalizeName = (name) => {
  return name.toLowerCase()
}

const normalizeVersion = (version) => {
  if (version.indexOf(".") > -1) {
    const parts = version.split(".")
    // remove extraneous .
    return parts.slice(0, 3).join(".")
  }

  if (version.indexOf("_") > -1) {
    const parts = version.split("_")
    // remove extraneous _
    return parts.slice(0, 3).join("_")
  }

  return version
}
