import { ressourceToFirstDirectory } from "../urlHelper.js"
import { createRequestToFileResponse } from "../createRequestToFileResponse/index.js"

export const isCacheRequest = (request, cacheFolder) => {
  return ressourceToFirstDirectory(request.ressource) === cacheFolder
}

export const createCacheRequestToResponse = ({ root, cacheFolder, cacheIgnore, cacheStrategy }) => {
  const cacheService = createRequestToFileResponse({ root, cacheIgnore, cacheStrategy })

  return (request) => {
    if (isCacheRequest(request, cacheFolder)) {
      return cacheService(request)
    }
    return null
  }
}
