import { urlToOrigin, urlToRessource, urlToExtension } from "@jsenv/filesystem"

export const urlWithoutSearch = (url) => {
  const urlObject = new URL(url)
  urlObject.search = ""
  return urlObject.href
}

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

export const injectQuery = (url, params) => {
  const urlObject = new URL(url)
  const { searchParams } = urlObject
  Object.keys(params).forEach((key) => {
    searchParams.set(key, params[key])
  })
  return String(urlObject)
}

export const injectQueryIntoUrlSpecifier = (specifier, params) => {
  const url = new URL(specifier, "https://jsenv.dev/")
  const urlWithParams = injectQuery(url, params)
  const { origin, pathname, search, href } = new URL(urlWithParams)
  const ressource = `${pathname}${search}`
  if (specifier.slice(0, 2) === "./") {
    return `./${ressource.slice(1)}`
  }
  if (specifier[0] === "/") {
    return ressource
  }
  // specifier was relative
  if (origin === "https://jsenv.dev") {
    return ressource.slice(1)
  }
  return href
}
