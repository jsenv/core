import { resolveUrl, urlToRelativeUrl, readFile, ensureWindowsDriveLetter } from "@jsenv/util"
import {
  replaceBackSlashesWithSlashes,
  startsWithWindowsDriveLetter,
  windowsFilePathToUrl,
} from "../../filePathUtils.js"
import { setJavaScriptSourceMappingUrl, sourcemapToBase64Url } from "../../sourceMappingURLUtils.js"
import { generateCompiledFileAssetUrl } from "../compile-directory/compile-asset.js"

const isWindows = process.platform === "win32"

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

  let output = code
  if (remap && map) {
    if (map.sources.length === 0) {
      // may happen in some cases where babel returns a wrong sourcemap
      // there is at least one case where it happens
      // a file with only import './whatever.js' inside
      sources.push(originalFileUrl)
      sourcesContent.push(originalFileContent)
    } else {
      await Promise.all(
        map.sources.map(async (source, index) => {
          // be careful here we might received C:/Directory/file.js path from babel
          // also in case we receive relative path like directory\file.js we replace \ with slash
          // for url resolution
          const sourceFileUrl =
            isWindows && startsWithWindowsDriveLetter(source)
              ? windowsFilePathToUrl(source)
              : ensureWindowsDriveLetter(
                  resolveUrl(
                    isWindows ? replaceBackSlashesWithSlashes(source) : source,
                    sourcemapFileUrl,
                  ),
                  sourcemapFileUrl,
                )

          if (!sourceFileUrl.startsWith(projectDirectoryUrl)) {
            // do not track dependency outside project
            // it means cache stays valid for those external sources
            return
          }

          map.sources[index] = urlToRelativeUrl(sourceFileUrl, sourcemapFileUrl)
          sources[index] = sourceFileUrl

          if (map.sourcesContent && map.sourcesContent[index]) {
            sourcesContent[index] = map.sourcesContent[index]
          } else {
            const sourceFileContent = await readFile(sourceFileUrl)
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
      output = setJavaScriptSourceMappingUrl(output, sourcemapToBase64Url(map))
    } else if (remapMethod === "comment") {
      const sourcemapFileRelativePathForModule = urlToRelativeUrl(sourcemapFileUrl, compiledFileUrl)
      output = setJavaScriptSourceMappingUrl(output, sourcemapFileRelativePathForModule)
      assets.push(sourcemapFileUrl)
      assetsContent.push(stringifyMap(map))
    }
  } else {
    sources.push(originalFileUrl)
    sourcesContent.push(originalFileContent)
  }

  const { coverage } = metadata
  if (coverage) {
    const coverageAssetFileUrl = generateCompiledFileAssetUrl(compiledFileUrl, "coverage.json")
    assets.push(coverageAssetFileUrl)
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
