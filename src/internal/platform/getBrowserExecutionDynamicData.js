import { urlToRelativeUrl, pathToFileUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"

export const getBrowserExecutionDynamicData = ({ projectDirectoryUrl, compileServerOrigin }) => {
  const browserPlatformFileRelativeUrl =
    projectDirectoryUrl === jsenvCoreDirectoryUrl
      ? "src/browserPlatform.js"
      : `${urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl)}src/browserPlatform.js`

  const sourcemapMainFileUrl = pathToFileUrl(
    import.meta.require.resolve("source-map/dist/source-map.js"),
  )
  const sourcemapMappingFileUrl = pathToFileUrl(
    import.meta.require.resolve("source-map/lib/mappings.wasm"),
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
