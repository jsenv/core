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

export const getUrlSearchParamsDescriptor = (url) => {
  const urlObject = new URL(url)
  const { searchParams } = urlObject
  const searchParamsDescriptor = {}
  Array.from(searchParams.keys()).forEach((key) => {
    const value = searchParams.getAll(key)
    searchParamsDescriptor[key] = value.length === 1 ? value[0] : value
  })
  return searchParamsDescriptor
}

export const setUrlSearchParamsDescriptor = (url, searchParamsDescriptor) => {
  const urlObject = new URL(url)
  const { searchParams } = urlObject
  Object.keys(searchParamsDescriptor).forEach((key) => {
    searchParams.append(key, searchParamsDescriptor[key])
  })
  return String(urlObject)
}
