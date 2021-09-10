import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { setJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"

export const createBuildFileContents = ({ rollupBuild, buildDirectoryUrl }) => {
  const buildFileContents = {}
  Object.keys(rollupBuild).forEach((buildRelativeUrl) => {
    const rollupFileInfo = rollupBuild[buildRelativeUrl]
    const fileBuildUrl = resolveUrl(buildRelativeUrl, buildDirectoryUrl)

    if (rollupFileInfo.type === "asset") {
      buildFileContents[buildRelativeUrl] = rollupFileInfo.source
      return
    }

    const { code, map } = rollupFileInfo

    if (!map) {
      buildFileContents[buildRelativeUrl] = code
      return
    }

    const sourcemapBuildRelativeUrl = `${buildRelativeUrl}.map`
    const sourcemapRollupFileInfo = rollupBuild[sourcemapBuildRelativeUrl]
    if (sourcemapRollupFileInfo) {
      // already in rollup build, sourcemap will be found
      buildFileContents[buildRelativeUrl] = code
      return
    }

    const sourcemapBuildUrl = resolveUrl(sourcemapBuildRelativeUrl, buildDirectoryUrl)
    const fileSourcemapString = JSON.stringify(map, null, "  ")
    buildFileContents[sourcemapBuildRelativeUrl] = fileSourcemapString

    const sourcemapBuildUrlRelativeToFileBuildUrl = urlToRelativeUrl(
      sourcemapBuildUrl,
      fileBuildUrl,
    )
    const codeWithSourcemapComment = setJavaScriptSourceMappingUrl(
      code,
      sourcemapBuildUrlRelativeToFileBuildUrl,
    )
    buildFileContents[buildRelativeUrl] = codeWithSourcemapComment
  })
  return buildFileContents
}
