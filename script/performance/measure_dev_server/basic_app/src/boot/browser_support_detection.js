/*
 * This file is inlined in the HTML file by [data-jsenv-force-inline]
 * Responsabilities:
 * - Set window.browserIsSupported boolean
 * - Display #browser_not_supported div when browser is not supported
 * This file will be executed as such in every browsers. It will just be minified.
 * -> The JS used must be as compatible as possible (no const, no arrow function etc)
 */

var userAgent = window.navigator.userAgent

function browserIsSupported() {
  var isIE = typeof document.documentMode !== "undefined"
  if (isIE) {
    return false
  }

  var chromeVersion = versionFromUserAgent(
    /(?:chrome|chromium|crios|crmo)\/(\d+)/i,
  )
  if (chromeVersion && chromeVersion < 55) {
    return false
  }

  var edgeVersion = versionFromUserAgent(
    /(?:edge|edgea|edgios)\/(\d+)/i,
    userAgent,
  )
  if (edgeVersion && edgeVersion < 14) {
    return false
  }

  var firefoxVersion = versionFromUserAgent(
    /(?:firefox|iceweasel|fxios)[\s/](\d+)/i,
  )
  if (firefoxVersion && firefoxVersion < 52) {
    return false
  }

  var safariVersion =
    !chromeVersion && /safari|applewebkit/i.test(userAgent)
      ? versionFromUserAgent(/version\/(\d+)/i)
      : undefined
  if (safariVersion && safariVersion < 11) {
    return false
  }

  return true
}

function versionFromUserAgent(regexp) {
  var match = userAgent.match(regexp)
  if (!match || match.length === 0) return undefined
  var firstMatch = match[1]
  var version = parseInt(firstMatch)
  return version
}

window.browserIsSupported = browserIsSupported()

if (!window.browserIsSupported) {
  document.getElementById("browser_not_supported").style.display = "block"
}
