export const applyLeadingSlashUrlResolution = (specifier, rootDirectoryUrl) => {
  if (specifier.startsWith("/@fs/")) {
    const url = new URL(specifier.slice("/@fs".length), rootDirectoryUrl).href
    return url
  }
  if (specifier[0] === "/") {
    const url = new URL(specifier.slice(1), rootDirectoryUrl).href
    return url
  }
  return null
}
