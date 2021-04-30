/* eslint-env browser, node */
export const getRuntimeName = () => {
  if (typeof window === "object") return "browser"
  if (typeof global === "object") return "node"
  return "other"
}
