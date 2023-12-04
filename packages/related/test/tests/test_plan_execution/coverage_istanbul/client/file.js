var userAgent = window.navigator.userAgent;
function versionFromUserAgent(regexp) {
  var match = userAgent.match(regexp);
  if (!match || match.length === 0) return undefined;
  var firstMatch = match[1];
  var version = parseInt(firstMatch);
  return version;
}
var chromeVersion = versionFromUserAgent(
  /(?:chrome|chromium|crios|crmo)\/(\d+)/i,
);
var firefoxVersion = versionFromUserAgent(
  /(?:firefox|iceweasel|fxios)[\s/](\d+)/i,
);
var safariVersion =
  !chromeVersion && /safari|applewebkit/i.test(userAgent)
    ? versionFromUserAgent(/version\/(\d+)/i)
    : undefined;

if (chromeVersion) {
  console.log("chrome");
} else if (firefoxVersion) {
  console.log("firefox");
} else if (safariVersion) {
  console.log("safari");
} else {
  console.log("other");
}
