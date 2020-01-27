export const getPlatformName = () => {
  if (typeof window === "object") return "browser"
  if (typeof global === "object") return "node"
  return "other"
}
