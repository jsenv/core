import { getPlatformNameAndVersionFromHeaders } from "./getPlatformNameAndVersionFromHeaders.js"
import { getFileCompiledToResponseForRequest } from "./getFileCompiledToResponseForRequest.js"
import { getFileCompiledAssetLocationToResponseForRequest } from "./getFileCompiledAssetLocationToResponseForRequest.js"

// the helper below can be passed to compilerJSToService
// import { createCompileProfiles } from "./createCompileProfiles/createCompileProfiles.js"
// const {getGroupIdForPlatform, getPluginsFromGroupId} = createCompileProfiles({ root, into: 'group.config.json'})
// in order to have dynamic babel plugins

export const compilerJSToService = ({
  getFileCompiled,
  getFileCompiledAssetLocation,
  getGroupIdForPlatform = () => "anonymous",
  getPluginsFromGroupId = () => [],
}) => {
  return ({ method, url, headers }) => {
    const { platformName, platformVersion } = getPlatformNameAndVersionFromHeaders(headers)
    const groupId = getGroupIdForPlatform({
      platformName,
      platformVersion,
    })
    const getBabelPlugins = () => getPluginsFromGroupId(groupId)

    if (url.pathname.endsWith(".map")) {
      // if we receive something like compiled/folder/file.js.map
      // we redirect to build/folder/file.js/jqjcijjojio/file.js.map
      return getFileCompiledAssetLocationToResponseForRequest(
        (data) => {
          return getFileCompiledAssetLocation({
            groupId,
            getBabelPlugins,
            ...data,
          })
        },
        {
          method,
          url,
          headers,
        },
      )
    }

    return getFileCompiledToResponseForRequest(
      (data) => {
        return getFileCompiled({
          groupId,
          getBabelPlugins,
          ...data,
        })
      },
      { method, url, headers },
    )
  }
}
