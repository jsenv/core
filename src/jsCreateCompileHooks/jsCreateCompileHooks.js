import { pluginNameToPlugin as defaultPluginNameToPlugin } from "@dmail/project-structure-compile-babel"
import { getPlatformNameAndVersionFromHeaders } from "./getPlatformNameAndVersionFromHeaders.js"
import { platformMatchCompatMap } from "./createCompileProfiles/index.js"
import { getCompatGroupMap, DEFAULT_ID } from "./getCompatGroupMap.js"
import { openServer } from "../openServer/index.js"
import { convertFunctionAndArgumentsToSource } from "../convertFunctionAndArgumentsToSource.js"

const createCompileIdToParam = (compatGroupMap, pluginNameToPlugin, pluginNameToOptions) => {
  return (compileId) => {
    const pluginNames = compatGroupMap[compileId].pluginNames

    return {
      //this is how babel expect us to pass option to plugin
      plugins: pluginNames.map((pluginName) => {
        return [pluginNameToPlugin(pluginName), pluginNameToOptions(pluginName) || {}]
      }),
    }
  }
}

const createBalanceService = (compatGroupMap) => {
  const requestToCompileId = (compatGroupMap, request) => {
    const { platformName, platformVersion } = getPlatformNameAndVersionFromHeaders(request.headers)

    const compileId =
      Object.keys(compatGroupMap).find((id) => {
        const { compatMap } = compatGroupMap[id]
        return platformMatchCompatMap({ compatMap, platformName, platformVersion })
      }) || DEFAULT_ID

    return compileId
  }

  return (request) => {
    const compileId = requestToCompileId(compatGroupMap, request)
    const body = JSON.stringify(compileId)

    return {
      headers: {
        // vary by user-agent because we use it to provided different file
        vary: "User-Agent",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      },
      body,
    }
  }
}

export const jsCreateCompileHooks = ({
  configLocation,

  stats,
  compatMap,
  size,
  platformNames,
  moduleOutput = "systemjs",
  pluginNames,

  protocol,
  pluginNameToPlugin = defaultPluginNameToPlugin,
  pluginNameToOptions = () => {},
}) => {
  return getCompatGroupMap({
    configLocation,
    stats,
    compatMap,
    size,
    platformNames,
    moduleOutput,
    pluginNames,
  }).then((compatGroupMap) => {
    return openServer({
      protocol,
      requestToResponse: createBalanceService(compatGroupMap),
    }).then((server) => {
      return {
        compileIdToCompileParams: createCompileIdToParam(
          compatGroupMap,
          pluginNameToPlugin,
          pluginNameToOptions,
        ),
        getCompileIdSource: convertFunctionAndArgumentsToSource(
          (serverOrigin) => {
            return () => {
              // eslint-disable-next-line no-undef
              return System.import(serverOrigin)
            }
          },
          [server.origin],
        ),
      }
    })
  })
}
