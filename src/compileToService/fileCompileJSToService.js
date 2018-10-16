import {
  promiseToResponse as defaultPromiseToResponse,
  requestToParam as defaultRequestToParam,
} from "./fileCompileToService.js"
import { getPlatformNameAndVersionFromHeaders } from "./getPlatformNameAndVersionFromHeaders.js"
import { responseCompose } from "../openServer/index.js"
import { createFileService } from "../createFileService/index.js"

export const fileCompileJSToService = (
  fileCompileJS,
  {
    root,
    cacheFolder = "",
    compileFolder = "",
    cacheDisabled,
    // the helper below can be passed to fileCompileJSToService
    // import { createCompileProfiles } from "./createCompileProfiles/createCompileProfiles.js"
    // const {getGroupIdForPlatform, getPluginsFromGroupId} = createCompileProfiles({ root, into: 'group.config.json'})
    // in order to have dynamic babel plugins
    getGroupIdForPlatform = () => "anonymous",
    getPluginsFromGroupId = () => [],
  },
) => {
  const cacheFileService = createFileService({ root, cacheDisabled })

  const requestToParam = (request, options) => {
    const { type, ...rest } = defaultRequestToParam(request, options)

    if (type === "compile") {
      const { headers } = request
      const { platformName, platformVersion } = getPlatformNameAndVersionFromHeaders(headers)
      const groupId = getGroupIdForPlatform({
        platformName,
        platformVersion,
      })
      const getBabelPlugins = () => getPluginsFromGroupId(groupId)

      return {
        type,
        ...rest,
        groupId,
        getBabelPlugins,
      }
    }

    return {
      type,
      ...rest,
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
    const { type, ...rest } = requestToParam(request, { cacheFolder, compileFolder })

    if (type === "cache") {
      return cacheFileService(request).then((response) => {
        return responseCompose({ headers: { vary: "User-Agent" } }, response)
      })
    }

    if (type === "compile") {
      return promiseToResponse(fileCompileJS(rest))
    }

    return null
  }
}
