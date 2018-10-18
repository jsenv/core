import {
  createRequestToFileResponse,
  convertFileSystemErrorToResponseProperties,
} from "../createRequestToFileResponse/index.js"

export const ressourceToGroupAndFile = (ressource, into, groupMap) => {
  const parts = ressource.split("/")
  const firstPart = parts[0]

  if (firstPart !== into) {
    return null
  }

  const secondPart = parts[1]
  if (secondPart in groupMap === false) {
    return null
  }

  if (parts[2].length === 0) {
    return null
  }

  const file = parts.slice(2).join("/")

  if (file.match(/^[^\/]+__meta__\/.+$/)) {
    return {
      group: secondPart,
      asset: file,
    }
  }

  return {
    group: secondPart,
    file,
  }
}

export const compileFileToService = (
  compileFile,
  {
    root,
    into,
    groupMap,
    cacheIgnore = false,
    cacheTrackHit = false,
    assetCacheIgnore = false,
    assetCacheStrategy = "etag",
  },
) => {
  const fileService = createRequestToFileResponse({
    root,
    cacheIgnore: assetCacheIgnore,
    cacheStrategy: assetCacheStrategy,
  })

  return (request) => {
    // si y'a pas de groupe faudrait servir le fichier tel quel
    // si on demande un asset faut le servir tel quel
    const { group, file } = ressourceToGroupAndFile(request.ressource, into, groupMap)

    if (!group || !file) {
      return fileService(request)
    }

    const promise = compileFile({
      group,
      groupParams: groupMap[group],
      file,
      eTag: "if-none-match" in request.headers ? request.headers["if-none-match"] : undefined,
      cacheIgnore,
      cacheTrackHit,
    })

    return promise.then(
      ({ eTagValid, eTag, outputName, output }) => {
        // here status can be "created", "updated", "cached"

        // je crois, que, normalement
        // il faudrait "aider" le browser pour que tout ça ait du sens
        // genre lui envoyer une redirection vers le fichier en cache
        // genre renvoyer 201 vers le cache lorsqu'il a été update ou créé
        // https://developer.mozilla.org/fr/docs/Web/HTTP/Status/201
        // renvoyer 302 ou 307 lorsque le cache existe
        // l'intérêt c'est que si jamais le browser fait une requête vers le cache
        // il sait à quoi ça correspond vraiment
        // par contre ça fait 2 requête http

        if (eTagValid) {
          return {
            status: 304,
            headers: {
              // do I have to send that ? browser cache should be sufficient
              // "x-location": outputName,
            },
          }
        }

        return {
          status: 200,
          headers: {
            ...(cacheIgnore ? { "cache-control": "no-store" } : {}),
            etag: eTag,
            "content-length": Buffer.byteLength(output),
            "content-type": "application/javascript",
            "x-location": outputName,
          },
          body: output,
        }
      },
      (error) => {
        if (error && error.reason === "Unexpected directory operation") {
          return {
            status: 403,
          }
        }
        if (error && error.code === "CACHE_CORRUPTION_ERROR") {
          return {
            status: 500,
          }
        }
        return convertFileSystemErrorToResponseProperties(error)
      },
    )
  }
}
