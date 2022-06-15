export const urlIsInsideOf = (url, otherUrl) => {
  const urlObject = new URL(url)
  const otherUrlObject = new URL(otherUrl)

  if (urlObject.origin !== otherUrlObject.origin) {
    return false
  }

  const urlPathname = urlObject.pathname
  const otherUrlPathname = otherUrlObject.pathname
  if (urlPathname === otherUrlPathname) {
    return false
  }

  const isInside = urlPathname.startsWith(otherUrlPathname)
  return isInside
}
