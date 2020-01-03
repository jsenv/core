import { resolveUrl, fileUrlToRelativePath, urlToFileSystemPath } from "@jsenv/util"
import { isWindowsFilePath, windowsFilePathToUrl } from "internal/filePathUtils.js"
import { writeSourceMappingURL } from "internal/sourceMappingURLUtils.js"
import { readFileContent } from "internal/filesystemUtils.js"

export const transformResultToCompilationResult = async (
  { code, map, metadata = {} },
  {
    projectDirectoryUrl,
    originalFileContent,
    originalFileUrl,
    compiledFileUrl,
    sourcemapFileUrl,
    remap = true,
    remapMethod = "comment", // 'comment', 'inline'
  },
) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof originalFileContent !== "string") {
    throw new TypeError(`originalFileContent must be a string, got ${originalFileContent}`)
  }
  if (typeof originalFileUrl !== "string") {
    throw new TypeError(`originalFileUrl must be a string, got ${originalFileUrl}`)
  }
  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(`compiledFileUrl must be a string, got ${compiledFileUrl}`)
  }
  if (typeof sourcemapFileUrl !== "string") {
    throw new TypeError(`sourcemapFileUrl must be a string, got ${sourcemapFileUrl}`)
  }

  const sources = []
  const sourcesContent = []
  const assets = []
  const assetsContent = []

  const metaJsonFileUrl = `${compiledFileUrl}__asset__/meta.json`

  let output = code
  if (remap && map) {
    if (map.sources.length === 0) {
      // may happen in some cases where babel returns a wrong sourcemap
      // there is at least one case where it happens
      // a file with only import './whatever.js' inside
      sources.push(fileUrlToRelativePath(originalFileUrl, metaJsonFileUrl))
      sourcesContent.push(originalFileContent)
    } else {
      await Promise.all(
        map.sources.map(async (source, index) => {
          const sourceFileUrl = isWindowsFilePath(source)
            ? windowsFilePathToUrl(source)
            : resolveUrl(source, sourcemapFileUrl)

          if (!sourceFileUrl.startsWith(projectDirectoryUrl)) {
            // do not track dependency outside project
            // it means cache stays valid for those external sources
            return
          }

          map.sources[index] = fileUrlToRelativePath(sourceFileUrl, sourcemapFileUrl)
          sources[index] = fileUrlToRelativePath(sourceFileUrl, metaJsonFileUrl)

          if (map.sourcesContent && map.sourcesContent[index]) {
            sourcesContent[index] = map.sourcesContent[index]
          } else {
            const sourceFilePath = urlToFileSystemPath(sourceFileUrl)
            const sourceFileContent = await readFileContent(sourceFilePath)
            sourcesContent[index] = sourceFileContent
          }
        }),
      )
    }

    // removing sourcesContent from map decrease the sourceMap
    // it also means client have to fetch source from server (additional http request)
    // some client ignore sourcesContent property such as vscode-chrome-debugger
    // Because it's the most complex scenario and we want to ensure client is always able
    // to find source from the sourcemap, we explicitely delete map.sourcesContent to test this.
    delete map.sourcesContent

    // we don't need sourceRoot because our path are relative or absolute to the current location
    // we could comment this line because it is not set by babel because not passed during transform
    delete map.sourceRoot

    if (remapMethod === "inline") {
      const mapAsBase64 = Buffer.from(JSON.stringify(map)).toString("base64")
      output = writeSourceMappingURL(
        output,
        `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
      )
    } else if (remapMethod === "comment") {
      const sourcemapFileRelativePathForModule = fileUrlToRelativePath(
        sourcemapFileUrl,
        compiledFileUrl,
      )
      output = writeSourceMappingURL(output, sourcemapFileRelativePathForModule)
      const sourcemapFileRelativePathForAsset = fileUrlToRelativePath(
        sourcemapFileUrl,
        `${compiledFileUrl}__asset__/`,
      )
      assets.push(sourcemapFileRelativePathForAsset)
      assetsContent.push(stringifyMap(map))
    }
  } else {
    sources.push(fileUrlToRelativePath(originalFileUrl, metaJsonFileUrl))
    sourcesContent.push(originalFileContent)
  }

  const { coverage } = metadata
  if (coverage) {
    assets.push(`coverage.json`)
    assetsContent.push(stringifyCoverage(coverage))
  }

  return {
    compiledSource: output,
    contentType: "application/javascript",
    sources,
    sourcesContent,
    assets,
    assetsContent,
  }
}

const stringifyMap = (object) => JSON.stringify(object, null, "  ")

const stringifyCoverage = (object) => JSON.stringify(object, null, "  ")
