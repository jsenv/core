import {
  resolveUrl,
  urlToRelativeUrl,
  readFile,
  ensureWindowsDriveLetter,
} from "@jsenv/filesystem"
import {
  replaceBackSlashesWithSlashes,
  startsWithWindowsDriveLetter,
  windowsFilePathToUrl,
} from "../filePathUtils.js"
import {
  setJavaScriptSourceMappingUrl,
  setCssSourceMappingUrl,
  sourcemapToBase64Url,
} from "../sourceMappingURLUtils.js"
import { generateCompiledFileAssetUrl } from "./compile-directory/compile-asset.js"

const isWindows = process.platform === "win32"

export const transformResultToCompilationResult = async (
  { code, map, contentType = "application/javascript", metadata = {} },
  {
    projectDirectoryUrl,
    originalFileContent,
    originalFileUrl,
    compiledFileUrl,
    sourcemapFileUrl,
    sourcemapEnabled = true,
    // removing sourcesContent from map decrease the sourceMap
    // it also means client have to fetch source from server (additional http request)
    // some client ignore sourcesContent property such as vscode-chrome-debugger
    // Because it's the most complex scenario and we want to ensure client is always able
    // to find source from the sourcemap, we remove map.sourcesContent by default to test this.
    sourcemapExcludeSources = true,
    sourcemapMethod = "comment", // "comment", "inline"
  },
) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(
      `projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`,
    )
  }
  if (typeof originalFileContent !== "string") {
    throw new TypeError(
      `originalFileContent must be a string, got ${originalFileContent}`,
    )
  }
  if (typeof originalFileUrl !== "string") {
    throw new TypeError(
      `originalFileUrl must be a string, got ${originalFileUrl}`,
    )
  }
  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(
      `compiledFileUrl must be a string, got ${compiledFileUrl}`,
    )
  }
  if (typeof sourcemapFileUrl !== "string") {
    throw new TypeError(
      `sourcemapFileUrl must be a string, got ${sourcemapFileUrl}`,
    )
  }

  const sources = []
  const sourcesContent = []
  const assets = []
  const assetsContent = []

  let output = code
  if (sourcemapEnabled && map) {
    if (map.sources.length === 0) {
      // may happen in some cases where babel returns a wrong sourcemap
      // there is at least one case where it happens
      // a file with only import './whatever.js' inside
      sources.push(originalFileUrl)
      sourcesContent.push(originalFileContent)
    } else {
      map.sources.forEach((source, index) => {
        const sourceFileUrl = resolveSourceUrl({ source, sourcemapFileUrl })
        if (!sourceFileUrl.startsWith(projectDirectoryUrl)) {
          // do not track dependency outside project
          // it means cache stays valid for those external sources
          return
        }
        map.sources[index] = urlToRelativeUrl(sourceFileUrl, sourcemapFileUrl)
        sources[index] = sourceFileUrl
      })

      await Promise.all(
        sources.map(async (sourceUrl, index) => {
          const contentFromSourcemap = map.sourcesContent
            ? map.sourcesContent[index]
            : null
          if (contentFromSourcemap) {
            sourcesContent[index] = contentFromSourcemap
          } else {
            const contentFromFile = await readFile(sourceUrl)
            sourcesContent[index] = contentFromFile
          }
        }),
      )
    }

    if (sourcemapExcludeSources) {
      delete map.sourcesContent
    }

    // we don't need sourceRoot because our path are relative or absolute to the current location
    // we could comment this line because it is not set by babel because not passed during transform
    delete map.sourceRoot

    const setSourceMappingUrl =
      contentType === "application/javascript"
        ? setJavaScriptSourceMappingUrl
        : setCssSourceMappingUrl

    if (sourcemapMethod === "inline") {
      output = setSourceMappingUrl(output, sourcemapToBase64Url(map))
    } else if (sourcemapMethod === "comment") {
      const sourcemapFileRelativePathForModule = urlToRelativeUrl(
        sourcemapFileUrl,
        compiledFileUrl,
      )
      output = setSourceMappingUrl(output, sourcemapFileRelativePathForModule)
      assets.push(sourcemapFileUrl)
      assetsContent.push(stringifyMap(map))
    }
  } else {
    sources.push(originalFileUrl)
    sourcesContent.push(originalFileContent)
  }

  const { coverage } = metadata
  if (coverage) {
    const coverageAssetFileUrl = generateCompiledFileAssetUrl(
      compiledFileUrl,
      "coverage.json",
    )
    assets.push(coverageAssetFileUrl)
    assetsContent.push(stringifyCoverage(coverage))
  }

  return {
    compiledSource: output,
    contentType,
    sources,
    sourcesContent,
    assets,
    assetsContent,
  }
}

const resolveSourceUrl = ({ source, sourcemapFileUrl }) => {
  if (isWindows) {
    // we can receive:
    // - "C:/Directory/file.js" path from babel
    // - relative path like "directory\file.js" (-> we replace \ with slash)
    if (startsWithWindowsDriveLetter(source)) {
      return windowsFilePathToUrl(source)
    }
    const url = resolveUrl(
      replaceBackSlashesWithSlashes(source),
      sourcemapFileUrl,
    )
    return ensureWindowsDriveLetter(url)
  }

  return resolveUrl(source, sourcemapFileUrl)
}

const stringifyMap = (object) => JSON.stringify(object, null, "  ")

const stringifyCoverage = (object) => JSON.stringify(object, null, "  ")
