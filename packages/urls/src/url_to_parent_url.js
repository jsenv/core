import { urlToOrigin } from "./url_to_origin.js"
import { urlToRessource } from "./url_to_ressource.js"

export const urlToParentUrl = (url) => {
  const ressource = urlToRessource(url)
  const slashLastIndex = ressource.lastIndexOf("/")
  if (slashLastIndex === -1) {
    const urlAsString = String(url)
    return urlAsString
  }

  const lastCharacterIndex = ressource.length - 1
  if (slashLastIndex === lastCharacterIndex) {
    const slashPreviousIndex = ressource.lastIndexOf(
      "/",
      lastCharacterIndex - 1,
    )
    if (slashPreviousIndex === -1) {
      const urlAsString = String(url)
      return urlAsString
    }

    const origin = urlToOrigin(url)
    const parentUrl = `${origin}${ressource.slice(0, slashPreviousIndex + 1)}`
    return parentUrl
  }

  const origin = urlToOrigin(url)
  const parentUrl = `${origin}${ressource.slice(0, slashLastIndex + 1)}`
  return parentUrl
}
