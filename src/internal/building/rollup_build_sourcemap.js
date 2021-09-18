import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { setJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"

export const injectSourcemapInRollupBuild = (
  rollupBuild,
  { buildDirectoryUrl },
) => {
  const rollupBuildWithSourcemap = {}

  Object.keys(rollupBuild).forEach((buildRelativeUrl) => {
    const rollupFileInfo = rollupBuild[buildRelativeUrl]
    const { type, code, map } = rollupFileInfo

    if (type === "asset" || !map) {
      rollupBuildWithSourcemap[buildRelativeUrl] = rollupFileInfo
      return
    }

    const sourcemapBuildRelativeUrl = `${buildRelativeUrl}.map`
    const sourcemapRollupFileInfo = rollupBuild[sourcemapBuildRelativeUrl]
    if (sourcemapRollupFileInfo) {
      rollupBuildWithSourcemap[buildRelativeUrl] = rollupFileInfo
      return
    }

    const fileBuildUrl = resolveUrl(buildRelativeUrl, buildDirectoryUrl)
    const sourcemapBuildUrl = resolveUrl(
      sourcemapBuildRelativeUrl,
      buildDirectoryUrl,
    )
    const fileSourcemapString = JSON.stringify(map, null, "  ")
    const sourcemapBuildUrlRelativeToFileBuildUrl = urlToRelativeUrl(
      sourcemapBuildUrl,
      fileBuildUrl,
    )
    const codeWithSourcemapComment = setJavaScriptSourceMappingUrl(
      code,
      sourcemapBuildUrlRelativeToFileBuildUrl,
    )

    rollupBuildWithSourcemap[sourcemapBuildRelativeUrl] = {
      type: "asset",
      fileName: sourcemapBuildRelativeUrl,
      source: fileSourcemapString,
    }
    rollupBuildWithSourcemap[buildRelativeUrl] = {
      ...rollupFileInfo,
      code: codeWithSourcemapComment,
    }
  })

  return rollupBuildWithSourcemap
}
