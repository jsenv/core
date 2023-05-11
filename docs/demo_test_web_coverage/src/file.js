/* eslint-env browser */

if (window.navigator.userAgent.includes("Firefox")) {
  console.log("firefox")
} else if (window.navigator.userAgent.includes("Chrome")) {
  console.log("chrome")
} else if (window.navigator.userAgent.includes("AppleWebKit")) {
  console.log("webkit")
} else {
  console.log("other")
}
