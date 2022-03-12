export const applyLeadingSlashUrlResolution = (
  specifier,
  projectDirectoryUrl,
) => {
  if (specifier.startsWith("/@fs/")) {
    const url = new URL(specifier.slice("/@fs".length), projectDirectoryUrl)
      .href
    return url
  }
  if (specifier[0] === "/") {
    const url = new URL(specifier.slice(1), projectDirectoryUrl).href
    return url
  }
  return null
}
