import {
  createFileService,
  convertFileSystemErrorToResponseProperties,
} from "../createFileService/index.js"

const requestIsFor = ({ url }, { cacheFolderName, compileFolderName }) => {
  const pathname = url.pathname
  // '/compiled/folder/file.js' -> 'compiled/folder/file.js'
  const filename = pathname.slice(1)
  const dirname = filename.slice(0, filename.indexOf("/"))

  if (dirname === cacheFolderName) {
    return "cache"
  }
  if (dirname === compileFolderName) {
    return "compile"
  }
  return "other"
}

export const requestIsForCompile = (request, param) => {
  return requestIsFor(request, param) === "compile"
}

export const requestIsForCache = (request, param) => {
  return requestIsFor(request, param) === "cache"
}

export const requestToParam = ({ url, headers }) => {
  return {
    file: url.pathname.slice(1),
    eTag: "if-none-match" in headers ? headers["if-none-match"] : undefined,
  }
}

export const promiseToResponse = (promise) => {
  return promise.then(
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
          ...(cacheDisabled ? { "cache-control": "no-store" } : {}),
          ETag: inputETag,
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
      return convertFileSystemErrorToResponseProperties(error)
    },
  )
}

export const fileCompileToService = (fileCompile, { cacheFolderName, compileFolderName }) => {
  const fileService = createFileService()

  return (request) => {
    if (requestIsForCache(request, { compileFolderName, cacheFolderName })) {
      return fileService(request)
    }
    if (requestIsForCompile(request, compileFolderName)) {
      return promiseToResponse(fileCompile(requestToParam(request)))
    }
    return null
  }
}
