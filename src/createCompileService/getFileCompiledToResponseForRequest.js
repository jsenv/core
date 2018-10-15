import { convertFileSystemErrorToResponseProperties } from "../createFileService/index.js"

export const getFileCompiledToResponseForRequest = (getFileCompiled, request) => {
  const { url, headers } = request

  return getFileCompiled({
    file: url.pathname.slice(1),
    eTag: "if-none-match" in headers ? headers["if-none-match"] : undefined,
  }).then(
    ({ status, inputETag, outputRelativeLocation, output, cacheDisabled }) => {
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

      // c'est un peu optimiste ici de se dire que si c'est cached et qu'on a
      // if-none-match c'est forcément le etag du client qui a match
      // faudra changer ça non?
      if ("if-none-match" in headers && status === "cached") {
        return {
          status: 304,
          headers: {
            ...(cacheDisabled ? { "cache-control": "no-store" } : {}),
            vary: "User-Agent",
            "x-location": outputRelativeLocation,
          },
        }
      }

      return {
        status: 200,
        headers: {
          ...(cacheDisabled ? { "cache-control": "no-store" } : {}),
          ETag: inputETag,
          vary: "User-Agent",
          "content-length": Buffer.byteLength(output),
          "content-type": "application/javascript",
          "x-location": outputRelativeLocation,
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
      if (error && error.name === "PARSE_ERROR") {
        const json = JSON.stringify(error)

        return {
          status: 500,
          reason: "parse error",
          headers: {
            "cache-control": "no-store",
            "content-length": Buffer.byteLength(json),
            "content-type": "application/json",
          },
          body: json,
        }
      }
      return convertFileSystemErrorToResponseProperties(error)
    },
  )
}
