/* eslint-env browser */
if (typeof window === "object") {
  console.log("browser")
} else if (typeof process === "object") {
  console.log("node")
} else {
  console.log("other")
}
