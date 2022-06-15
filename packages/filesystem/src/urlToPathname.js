import { urlToRessource } from "./urlToRessource.js"

export const urlToPathname = (url) => {
  const ressource = urlToRessource(url)
  const pathname = ressourceToPathname(ressource)
  return pathname
}

const ressourceToPathname = (ressource) => {
  const searchSeparatorIndex = ressource.indexOf("?")
  if (searchSeparatorIndex > -1) {
    return ressource.slice(0, searchSeparatorIndex)
  }
  const hashIndex = ressource.indexOf("#")
  if (hashIndex > -1) {
    return ressource.slice(0, hashIndex)
  }
  return ressource
}
