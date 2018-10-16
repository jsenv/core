import { ressourceToFirstDirectory } from "../urlHelper.js"
import { convertFileSystemErrorToResponseProperties } from "../createRequestToFileResponse/index.js"

export const compileFileResolveToResponse = ({
  status,
  inputETag,
  outputRelativeLocation,
  output,
  cacheIgnore,
}) => {
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
  if (status === "cached") {
    return {
      status: 304,
      headers: {
        // do I have to send that ? browser cache should be sufficient
        "x-location": outputRelativeLocation,
      },
    }
  }

  return {
    status: 200,
    headers: {
      ...(cacheIgnore ? { "cache-control": "no-store" } : {}),
      ETag: inputETag,
      "content-length": Buffer.byteLength(output),
      "content-type": "application/javascript",
      "x-location": outputRelativeLocation,
    },
  }
}

export const compileFileRejectToResponse = (error) => {
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
}

export const compileFilePromiseToResponse = (promise) => {
  return promise.then()
}

export const isCompileRequest = (request, compileFolder) => {
  return ressourceToFirstDirectory(request.ressource) === compileFolder
}

export const requestToCompileFileParam = (request, { compileFolder }) => {
  const file = request.ressource.slice(compileFolder.length + 1)
  const eTag = "if-none-match" in request.headers ? request.headers["if-none-match"] : undefined
  return { file, eTag }
}

export const createCompileRequestToResponse = ({ compileFile, compileFolder }) => {
  return (request) => {
    if (isCompileRequest(request, compileFolder)) {
      const promise = compileFile(requestToCompileFileParam(request, { compileFolder }))
      return promise.then(compileFileResolveToResponse, compileFileRejectToResponse)
    }
    return null
  }
}
