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
  { mainFileName, projectDirectoryUrl, compiledFileUrl, sourcemapFileUrl },
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

  if (mainFileName === undefined) {
    mainFileName = Object.keys(rollupBundle).find((key) => rollupBundle[key].isEntry)
  }

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

  const mainRollupFile = rollupBundle[mainFileName]
  const mainFile = parseRollupFile(mainRollupFile, {
    urlResponseBodyMap,
    sourcemapFileUrl,
    sourcemapFileRelativeUrlForModule: urlToRelativeUrl(sourcemapFileUrl, compiledFileUrl),
  })
  // mainFile.sourcemap.file = fileUrlToRelativePath(originalFileUrl, sourcemapFileUrl)
  trackDependencies(mainFile.dependencyMap)
  assets.push(sourcemapFileUrl)
  assetsContent.push(JSON.stringify(mainFile.sourcemap, null, "  "))

  Object.keys(rollupBundle).forEach((fileName) => {
    if (fileName === mainFileName) return

    const rollupFile = rollupBundle[fileName]
    const file = parseRollupFile(rollupFile, {
      urlResponseBodyMap,
      compiledFileUrl,
      sourcemapFileUrl: resolveUrl(file.map.file, compiledFileUrl),
    })
    trackDependencies(file.dependencyMap)
    assets.push(resolveUrl(fileName), compiledFileUrl)
    assetsContent.push(file.content)
    assets.push(resolveUrl(`${fileName}.map`, compiledFileUrl))
    assetsContent.push(JSON.stringify(rollupFile.sourcemap, null, "  "))
  })

  return {
    contentType: "application/javascript",
    compiledSource: mainFile.content,
    sources,
    sourcesContent,
    assets,
    assetsContent,
  }
}

const parseRollupFile = (
  rollupFile,
  {
    urlResponseBodyMap,
    sourcemapFileUrl,
    sourcemapFileRelativeUrlForModule = `./${rollupFile.fileName}.map`,
  },
) => {
  const dependencyMap = {}
  const mainModuleSourcemap = rollupFile.map

  mainModuleSourcemap.sources.forEach((source, index) => {
    const moduleUrl = resolveUrl(source, sourcemapFileUrl)
    dependencyMap[moduleUrl] = getModuleContent({
      urlResponseBodyMap,
      mainModuleSourcemap,
      moduleUrl,
      moduleIndex: index,
    })
  })

  const sourcemap = rollupFile.map

  const content = setJavaScriptSourceMappingUrl(rollupFile.code, sourcemapFileRelativeUrlForModule)

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
