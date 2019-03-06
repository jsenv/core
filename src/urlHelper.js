import path from "path"
import { URL } from "url"

// https://gist.github.com/dmail/54677cc3eae1661813e3a87840666f83#file-url-js

export const originToHostname = (origin) => {
  return new URL(origin).hostname
}

export const hrefToOrigin = (href) => {
  return new URL(href).origin
}

export const ressourceToPathname = (ressource) => {
  const searchSeparatorIndex = ressource.indexOf("?")
  return searchSeparatorIndex === -1 ? ressource : ressource.slice(0, searchSeparatorIndex)
}

export const ressourceToExtension = (ressource) => {
  return path.extname(ressourceToPathname(ressource)).slice(1)
}

export const ressourceToFirstDirectory = (ressource) => {
  const pathname = ressourceToPathname(ressource)
  const firstDirectory = pathname.slice(0, pathname.indexOf("/"))
  return firstDirectory
}
