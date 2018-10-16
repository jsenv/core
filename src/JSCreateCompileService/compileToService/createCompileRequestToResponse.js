import {
  isCompileRequest,
  requestToCompileFileParam as defaultRequestToCompileFileParam,
  compileFilePromiseToResponse as defaultCompileFilePromiseToResponse,
} from "../../compileToService/index.js"
import { getPlatformNameAndVersionFromHeaders } from "./getPlatformNameAndVersionFromHeaders.js"
import { responseCompose } from "../../openServer/index.js"

const requestToCompileFileParam = (request, { compileFolder, getGroupIdAndPluginsForPlatform }) => {
  const { headers } = request
  const { platformName, platformVersion } = getPlatformNameAndVersionFromHeaders(headers)
  const { id, plugins = [] } = getGroupIdAndPluginsForPlatform({
    platformName,
    platformVersion,
  })
  const getBabelPlugins = () => plugins

  return {
    ...defaultRequestToCompileFileParam(request, { compileFolder }),
    groupId: id,
    getBabelPlugins,
  }
}

const compileFilePromiseToResponse = (promise) => {
  return defaultCompileFilePromiseToResponse(promise).then(
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

export const createCompileRequestToResponse = ({
  compileFile,
  compileFolder,
  getGroupIdAndPluginsForPlatform,
}) => {
  return (request) => {
    if (isCompileRequest(request, compileFolder)) {
      const promise = compileFile(
        requestToCompileFileParam(request, {
          compileFolder,
          getGroupIdAndPluginsForPlatform,
        }),
      )
      return compileFilePromiseToResponse(promise)
    }
    return null
  }
}
