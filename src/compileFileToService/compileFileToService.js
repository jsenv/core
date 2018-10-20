import {
  createRequestToFileResponse,
  convertFileSystemErrorToResponseProperties,
} from "../createRequestToFileResponse/index.js"

export const ressourceToCompileIdAndFile = (ressource, into) => {
  const parts = ressource.split("/")
  const firstPart = parts[0]

  if (firstPart !== into) {
    return null
  }

  const compileId = parts[1]
  if (compileId.length === 0) {
    return null
  }

  const file = parts.slice(2).join("/")
  if (file.length === 0) {
    return null
  }

  if (file.match(/[^\/]+__meta__\/.+$/)) {
    return {
      compileId,
      asset: file,
    }
  }

  return {
    compileId,
    file,
  }
}

export const compileFileToService = (
  compileFile,
  {
    root,
    into,
    compileParamMap,
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

  return ({ ressource, method, headers = {}, body }) => {
    const { compileId, file } = ressourceToCompileIdAndFile(ressource, into)

    // no compileId or no asset we server the file without compiling it
    if (!compileId || !file) {
      return fileService({ ressource, method, headers, body })
    }

    const promise = compileFile({
      compileId,
      compileParamMap,
      file,
      eTag: "if-none-match" in headers ? headers["if-none-match"] : undefined,
      cacheIgnore,
      cacheTrackHit,
    })

    return promise.then(
      ({ eTagValid, eTag, output }) => {
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
          }
        }

        return {
          status: 200,
          headers: {
            ...(cacheIgnore ? { "cache-control": "no-store" } : {}),
            etag: eTag,
            "content-length": Buffer.byteLength(output),
            "content-type": "application/javascript",
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
