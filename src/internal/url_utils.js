import { urlToOrigin, urlToRessource, urlToExtension } from "@jsenv/filesystem"

export const setUrlExtension = (url, extension) => {
  const origin = urlToOrigin(url)
  const currentExtension = urlToExtension(url)
  const ressource = urlToRessource(url)
  const [pathname, search] = ressource.split("?")
  const pathnameWithoutExtension = currentExtension
    ? pathname.slice(0, -currentExtension.length)
    : pathname
  const newPathname = `${pathnameWithoutExtension}${extension}`
  return `${origin}${newPathname}${search ? `?${search}` : ""}`
}
