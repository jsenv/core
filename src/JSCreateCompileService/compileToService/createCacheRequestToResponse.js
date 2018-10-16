import { isCacheRequest } from "../../compileToService/index.js"
import { createRequestToFileResponse } from "../../createRequestToFileResponse/index.js"
import { responseCompose } from "../../openServer/index.js"

export const createCacheRequestToResponse = ({ root, cacheFolder, cacheIgnore, cacheStrategy }) => {
  const cacheService = createRequestToFileResponse({ root, cacheIgnore, cacheStrategy })

  return (request) => {
    if (isCacheRequest(request, cacheFolder)) {
      return cacheService(request).then((response) => {
        return responseCompose({ headers: { vary: "User-Agent" } }, response)
      })
    }
    return null
  }
}
