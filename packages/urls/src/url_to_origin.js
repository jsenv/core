export const urlToOrigin = (url) => {
  const urlString = String(url)
  if (urlString.startsWith("file://")) {
    return `file://`
  }
  return new URL(urlString).origin
}
