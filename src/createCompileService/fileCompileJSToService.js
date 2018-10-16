import {
  promiseToResponse as defaultPromiseToResponse,
  requestToParam as defaultRequestToParan,
  requestIsForCache,
  requestIsForCompile,
} from "./fileCompileToService.js"
import { getPlatformNameAndVersionFromHeaders } from "./getPlatformNameAndVersionFromHeaders.js"
import { responseCompose } from "../openServer/index.js"
import { createFileService } from "../createFileService/index.js"

export const fileCompileJSToService = (
  compileJS,
  {
    // the helper below can be passed to fileCompileJSToService
    // import { createCompileProfiles } from "./createCompileProfiles/createCompileProfiles.js"
    // const {getGroupIdForPlatform, getPluginsFromGroupId} = createCompileProfiles({ root, into: 'group.config.json'})
    // in order to have dynamic babel plugins
    getGroupIdForPlatform = () => "anonymous",
    getPluginsFromGroupId = () => [],
    compileFolderName = "",
    cacheFolderName = "",
  },
) => {
  const fileService = createFileService()

  const requestToParam = (request) => {
    const { headers } = request
    const { platformName, platformVersion } = getPlatformNameAndVersionFromHeaders(headers)
    const groupId = getGroupIdForPlatform({
      platformName,
      platformVersion,
    })
    const getBabelPlugins = () => getPluginsFromGroupId(groupId)

    return {
      groupId,
      getBabelPlugins,
      ...defaultRequestToParan(request),
    }
  }

  const promiseToResponse = (promise) => {
    return defaultPromiseToResponse(promise).then(
      (response) => {
        // vary by user-agent because we use it to provided different file
        return responseCompose({ headers: { vary: "User-Agent" } }, response)
      },
      (error) => {
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
        return Promise.reject(error)
      },
    )
  }

  return (request) => {
    if (requestIsForCache(request, { compileFolderName, cacheFolderName })) {
      return fileService(request).then((response) => {
        return responseCompose({ headers: { vary: "User-Agent" } }, response)
      })
    }

    if (requestIsForCompile(request, { compileFolderName, cacheFolderName })) {
      return promiseToResponse(compileJS(requestToParam(request)))
    }

    return null
  }
}
