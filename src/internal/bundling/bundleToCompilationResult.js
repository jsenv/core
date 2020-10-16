/*

One thing to keep in mind:
the sourcemap.sourcesContent will contains a json file transformed to js
while urlResponseBodyMap will contain the json file raw source because the corresponding
json file etag is used to invalidate the cache

*/

import { readFileSync } from "fs"
import { urlToRelativeUrl, urlToFileSystemPath, resolveUrl } from "@jsenv/util"
import { setJavaScriptSourceMappingUrl } from "../sourceMappingURLUtils.js"

export const bundleToCompilationResult = (
  { rollupBundle, urlResponseBodyMap },
  { projectDirectoryUrl, compiledFileUrl, sourcemapFileUrl },
) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(`compiledFileUrl must be a string, got ${compiledFileUrl}`)
  }
  if (typeof sourcemapFileUrl !== "string") {
    throw new TypeError(`sourcemapFileUrl must be a string, got ${sourcemapFileUrl}`)
  }

  const sources = []
  const sourcesContent = []

  const trackDependencies = (dependencyMap) => {
    Object.keys(dependencyMap).forEach((moduleUrl) => {
      // do not track dependency outside project
      if (!moduleUrl.startsWith(projectDirectoryUrl)) {
        return
      }

      if (!sources.includes(moduleUrl)) {
        sources.push(moduleUrl)
        sourcesContent.push(dependencyMap[moduleUrl])
      }
    })
  }

  const assets = []
  const assetsContent = []

  const mainChunk = parseRollupChunk(rollupBundle.output[0], {
    urlResponseBodyMap,
    sourcemapFileUrl,
    sourcemapFileRelativeUrlForModule: urlToRelativeUrl(sourcemapFileUrl, compiledFileUrl),
  })
  // mainChunk.sourcemap.file = fileUrlToRelativePath(originalFileUrl, sourcemapFileUrl)
  trackDependencies(mainChunk.dependencyMap)
  assets.push(sourcemapFileUrl)
  assetsContent.push(JSON.stringify(mainChunk.sourcemap, null, "  "))

  rollupBundle.output.slice(1).forEach((rollupChunk) => {
    const chunkFileName = rollupChunk.fileName
    const chunk = parseRollupChunk(rollupChunk, {
      urlResponseBodyMap,
      compiledFileUrl,
      sourcemapFileUrl: resolveUrl(rollupChunk.map.file, compiledFileUrl),
    })
    trackDependencies(chunk.dependencyMap)
    assets.push(resolveUrl(chunkFileName), compiledFileUrl)
    assetsContent.push(chunk.content)
    assets.push(resolveUrl(`${rollupChunk.fileName}.map`, compiledFileUrl))
    assetsContent.push(JSON.stringify(chunk.sourcemap, null, "  "))
  })

  return {
    contentType: "application/javascript",
    compiledSource: mainChunk.content,
    sources,
    sourcesContent,
    assets,
    assetsContent,
  }
}

const parseRollupChunk = (
  rollupChunk,
  {
    urlResponseBodyMap,
    sourcemapFileUrl,
    sourcemapFileRelativeUrlForModule = `./${rollupChunk.fileName}.map`,
  },
) => {
  const dependencyMap = {}
  const mainModuleSourcemap = rollupChunk.map

  mainModuleSourcemap.sources.forEach((source, index) => {
    const moduleUrl = resolveUrl(source, sourcemapFileUrl)
    dependencyMap[moduleUrl] = getModuleContent({
      urlResponseBodyMap,
      mainModuleSourcemap,
      moduleUrl,
      moduleIndex: index,
    })
  })

  const sourcemap = rollupChunk.map

  const content = setJavaScriptSourceMappingUrl(rollupChunk.code, sourcemapFileRelativeUrlForModule)

  return {
    dependencyMap,
    content,
    sourcemap,
  }
}

const getModuleContent = ({ urlResponseBodyMap, mainModuleSourcemap, moduleUrl, moduleIndex }) => {
  if (moduleUrl in urlResponseBodyMap) {
    return urlResponseBodyMap[moduleUrl]
  }

  // try to read it from mainModuleSourcemap
  const sourcesContent = mainModuleSourcemap.sourcesContent || []
  if (moduleIndex in sourcesContent) {
    const contentFromRollupSourcemap = sourcesContent[moduleIndex]
    if (contentFromRollupSourcemap !== null && contentFromRollupSourcemap !== undefined) {
      return contentFromRollupSourcemap
    }
  }

  // try to get it from filesystem
  if (moduleUrl.startsWith("file:///")) {
    const moduleFilePath = urlToFileSystemPath(moduleUrl)
    // this could be async but it's ok for now
    // making it async could be harder than it seems
    // because sourcesContent must be in sync with sources
    try {
      const moduleFileBuffer = readFileSync(moduleFilePath)
      const moduleFileString = String(moduleFileBuffer)
      return moduleFileString
    } catch (e) {
      if (e && e.code === "ENOENT") {
        throw new Error(`module file not found at ${moduleUrl}`)
      }
      throw e
    }
  }

  // it's an external ressource like http, throw
  throw new Error(`cannot fetch module content from ${moduleUrl}`)
}
