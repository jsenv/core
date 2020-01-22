import { urlToRelativeUrl, fileSystemPathToUrl } from "@jsenv/util"
import { require } from "../require.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"

export const getBrowserExecutionDynamicData = ({ projectDirectoryUrl, compileServerOrigin }) => {
  const browserPlatformFileRelativeUrl =
    projectDirectoryUrl === jsenvCoreDirectoryUrl
      ? "src/browserPlatform.js"
      : `${urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl)}src/browserPlatform.js`

  const sourcemapMainFileUrl = fileSystemPathToUrl(require.resolve("source-map/dist/source-map.js"))
  const sourcemapMappingFileUrl = fileSystemPathToUrl(
    require.resolve("source-map/lib/mappings.wasm"),
  )
  const sourcemapMainFileRelativeUrl = urlToRelativeUrl(sourcemapMainFileUrl, projectDirectoryUrl)
  const sourcemapMappingFileRelativeUrl = urlToRelativeUrl(
    sourcemapMappingFileUrl,
    projectDirectoryUrl,
  )

  return {
    browserPlatformFileRelativeUrl,
    sourcemapMainFileRelativeUrl,
    sourcemapMappingFileRelativeUrl,
    compileServerOrigin,
  }
}
