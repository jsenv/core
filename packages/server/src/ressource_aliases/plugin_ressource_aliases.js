import { URL_META } from "@jsenv/url-meta"

export const pluginRessourceAliases = (ressourceAliases) => {
  const aliases = {}
  Object.keys(ressourceAliases).forEach((key) => {
    aliases[asFileUrl(key)] = asFileUrl(ressourceAliases[key])
  })
  return {
    ressource_aliases: {
      onRequest: (request, { redirectRequest }) => {
        const ressourceBeforeAlias = request.ressource
        const urlAfterAliasing = URL_META.applyAliases({
          url: asFileUrl(request.pathname),
          aliases,
        })
        const ressourceAfterAlias = urlAfterAliasing.slice("file://".length)
        if (ressourceBeforeAlias === ressourceAfterAlias) {
          return
        }
        const ressource = replaceRessource(
          ressourceBeforeAlias,
          ressourceAfterAlias,
        )
        redirectRequest({
          ressourceBeforeAlias,
          ressource,
        })
      },
    },
  }
}

const asFileUrl = (specifier) => new URL(specifier, "file:///").href

const replaceRessource = (ressourceBeforeAlias, newValue) => {
  const urlObject = new URL(ressourceBeforeAlias, "file://")
  const searchSeparatorIndex = newValue.indexOf("?")
  if (searchSeparatorIndex > -1) {
    return newValue // let new value override search params
  }
  urlObject.pathname = newValue
  const ressource = `${urlObject.pathname}${urlObject.search}`
  return ressource
}
