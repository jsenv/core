/* eslint-env browser, node */
export default (() => {
  if (typeof window === "object") {
    return "browser"
  }
  if (typeof process === "object") {
    return "node"
  }
  return "other"
})()
