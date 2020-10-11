export const urlToScheme = (urlString) => {
  const colonIndex = urlString.indexOf(":")
  if (colonIndex === -1) return ""
  return urlString.slice(0, colonIndex)
}
