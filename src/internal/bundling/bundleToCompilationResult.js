/*

One thing to keep in mind:
the sourcemap.sourcesContent will contains a json file transformed to js
while sourcesContent will contain the json file raw source because the corresponding
json file etag is used to invalidate the cache

*/

import { readFileSync } from "fs"
import { fileUrlToRelativePath, urlToFileSystemPath, resolveUrl } from "@jsenv/util"
import { writeOrUpdateSourceMappingURL } from "internal/sourceMappingURLUtils.js"

export const bundleToCompilationResult = (
  { rollupBundle, moduleContentMap },
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

      const relativePath = fileUrlToRelativePath(moduleUrl, `${compiledFileUrl}__asset__/meta.json`)
      if (!sources.includes(relativePath)) {
        sources.push(relativePath)
        sourcesContent.push(dependencyMap[moduleUrl].contentRaw)
      }
    })
  }

  const assets = []
  const assetsContent = []

  const mainChunk = parseRollupChunk(rollupBundle.output[0], {
    moduleContentMap,
    sourcemapFileUrl,
    sourcemapFileRelativeUrlForModule: fileUrlToRelativePath(sourcemapFileUrl, compiledFileUrl),
  })
  // mainChunk.sourcemap.file = fileUrlToRelativePath(originalFileUrl, sourcemapFileUrl)
  trackDependencies(mainChunk.dependencyMap)
  assets.push(fileUrlToRelativePath(sourcemapFileUrl, `${compiledFileUrl}__asset__/`))
  assetsContent.push(JSON.stringify(mainChunk.sourcemap, null, "  "))

  rollupBundle.output.slice(1).forEach((rollupChunk) => {
    const chunkFileName = rollupChunk.fileName
    const chunk = parseRollupChunk(rollupChunk, {
      moduleContentMap,
      compiledFileUrl,
    })
    trackDependencies(chunk.dependencyMap)
    assets.push(chunkFileName)
    assetsContent.push(chunk.content)
    assets.push(`${rollupChunk.fileName}.map`)
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
    moduleContentMap,
    sourcemapFileUrl,
    sourcemapFileRelativeUrlForModule = `./${rollupChunk.fileName}.map`,
  },
) => {
  const dependencyMap = {}
  const mainModuleSourcemap = rollupChunk.map

  mainModuleSourcemap.sources.forEach((source, index) => {
    const moduleUrl = resolveUrl(source, sourcemapFileUrl)
    dependencyMap[moduleUrl] = getModuleContent({
      moduleContentMap,
      mainModuleSourcemap,
      moduleUrl,
      moduleIndex: index,
    })
  })

  const sourcemap = rollupChunk.map

  const content = writeOrUpdateSourceMappingURL(rollupChunk.code, sourcemapFileRelativeUrlForModule)

  return {
    dependencyMap,
    content,
    sourcemap,
  }
}

const getModuleContent = ({ moduleContentMap, mainModuleSourcemap, moduleUrl, moduleIndex }) => {
  if (moduleUrl in moduleContentMap) {
    return moduleContentMap[moduleUrl]
  }

  // try to read it from mainModuleSourcemap
  const sourcesContent = mainModuleSourcemap.sourcesContent || []
  if (moduleIndex in sourcesContent) {
    const contentFromRollupSourcemap = sourcesContent[moduleIndex]
    return {
      content: contentFromRollupSourcemap,
      contentRaw: contentFromRollupSourcemap,
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
      return {
        content: moduleFileString,
        contentRaw: moduleFileString,
      }
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
