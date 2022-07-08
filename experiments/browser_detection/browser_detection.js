// https://github.com/Ahmdrza/detect-browser/blob/26254f85cf92795655a983bfd759d85f3de850c6/detect-browser.js#L1
// https://github.com/lancedikson/bowser/blob/master/src/parser-browsers.js#L1

import { detectFromUserAgentData } from "./user_agent_data.js"
import { detectAndroid } from "./detect_android.js"
import { detectInternetExplorer } from "./detect_internet_explorer.js"
import { detectOpera } from "./detect_opera.js"
import { detectEdge } from "./detect_edge.js"
import { detectFirefox } from "./detect_firefox.js"
import { detectChrome } from "./detect_chrome.js"
import { detectSafari } from "./detect_safari.js"
import { detectElectron } from "./detect_electron.js"
import { detectIOS } from "./detect_ios.js"

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
  detectFromUserAgentData, // keep this first
  detectOpera,
  detectInternetExplorer,
  detectEdge,
  detectFirefox,
  detectChrome,
  detectSafari,
  detectElectron,
  detectIOS,
  detectAndroid,
])

export const detectBrowser = () => {
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
