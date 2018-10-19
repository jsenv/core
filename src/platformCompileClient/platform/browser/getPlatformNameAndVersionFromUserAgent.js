import parser from "ua-parser-js"

// could be imported from compileProfiles/compileProfiles.js
const availableBrowserNames = [
  "chrome",
  "edge",
  "firefox",
  "safari",
  "node",
  "ios",
  "opera",
  "electron",
]

// https://github.com/faisalman/ua-parser-js#methods
const mapping = {
  "chrome headless": "chrome",
  "chrome webview": "chrome",
  chromium: "chrome",

  iemobile: "ie",

  "opera tablet": "opera",
  "opera coast": "opera",
  "opera mini": "opera",
  "opera mobi": "opera",
  mozilla: "firefox",

  "mobile safari": "ios",
}

const normalizeBrowserName = (browserName) => {
  const browserNameLowerCase = browserName.toLowerCase()
  const mappedBrowserName =
    browserNameLowerCase in mapping ? mapping[browserNameLowerCase] : browserNameLowerCase

  return availableBrowserNames.indexOf(mappedBrowserName) === -1 ? "other" : mappedBrowserName
}

const normalizeBrowserVersion = (browserVersion) => {
  const parts = browserVersion.split(".")
  // remove extraneous .
  return parts.slice(0, 3).join(".")
}

export const getPlatformNameAndVersionFromUserAgent = (userAgent) => {
  const data = parser(userAgent)
  return {
    platformName: normalizeBrowserName(data.browser.name || ""),
    platformVersion: normalizeBrowserVersion(data.browser.version || "unknown"),
  }
}
