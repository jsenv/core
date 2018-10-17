import {
  isCompileRequest,
  requestToCompileFileParam as defaultRequestToCompileFileParam,
  compileFileResolveToResponse as defaultCompileFileResolveToResponse,
  compileFileRejectToResponse as defaultCompileFileRejectToResponse,
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

const compileFileResolveToResponse = (result) => {
  return defaultCompileFileResolveToResponse(result).then((response) => {
    const sourceMap = result.outputAssets.find(({ name }) => name.endsWith(".map"))

    return responseCompose(
      {
        headers: {
          // vary by user-agent because we use it to provided different file
          vary: "User-Agent",
          // send the sourcemap name to the client so it can embed it himself
          // using x-location/x-sourcemap-name
          "x-sourcemap-name": sourceMap.name,
        },
      },
      response,
    )
  })
}

const compileFileRejectToResponse = (error) => {
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
  return defaultCompileFileRejectToResponse(error)
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
      return promise.then(compileFileResolveToResponse, compileFileRejectToResponse)
    }
    return null
  }
}
