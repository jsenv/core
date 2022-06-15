import { getCommonPathname } from "./internal/getCommonPathname.js"
import { pathnameToParentPathname } from "./internal/pathnameToParentPathname.js"

export const urlToRelativeUrl = (url, baseUrl) => {
  const urlObject = new URL(url)
  const baseUrlObject = new URL(baseUrl)

  if (urlObject.protocol !== baseUrlObject.protocol) {
    const urlAsString = String(url)
    return urlAsString
  }

  if (
    urlObject.username !== baseUrlObject.username ||
    urlObject.password !== baseUrlObject.password ||
    urlObject.host !== baseUrlObject.host
  ) {
    const afterUrlScheme = String(url).slice(urlObject.protocol.length)
    return afterUrlScheme
  }

  const { pathname, hash, search } = urlObject
  if (pathname === "/") {
    const baseUrlRessourceWithoutLeadingSlash = baseUrlObject.pathname.slice(1)
    return baseUrlRessourceWithoutLeadingSlash
  }

  const basePathname = baseUrlObject.pathname
  const commonPathname = getCommonPathname(pathname, basePathname)
  if (!commonPathname) {
    const urlAsString = String(url)
    return urlAsString
  }
  const specificPathname = pathname.slice(commonPathname.length)
  const baseSpecificPathname = basePathname.slice(commonPathname.length)
  if (baseSpecificPathname.includes("/")) {
    const baseSpecificParentPathname =
      pathnameToParentPathname(baseSpecificPathname)
    const relativeDirectoriesNotation = baseSpecificParentPathname.replace(
      /.*?\//g,
      "../",
    )
    const relativeUrl = `${relativeDirectoriesNotation}${specificPathname}${search}${hash}`
    return relativeUrl
  }

  const relativeUrl = `${specificPathname}${search}${hash}`
  return relativeUrl
}
