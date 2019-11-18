/*

bundleToCompilationResult does two things:

1. Change every relative path inside rollup sourcemap to an "absolute" version.
Something like `../../importMap.json` becomes `/importMap.json`.
In the process // sourceMappingURL comment of the file referencing the sourcemap is updated.

We need this because vscode is configured with
```json
{
  "sourceMapPathOverrides": {
    "/*": "${workspaceFolder}/*"
  },
```
And we need to do that because I struggled to make vscode work with relative notations.

2. Return { compiledSource, sources, sourcesContent, assets, assetsContent }
It is usefull because this object can be used to create a cache for the bundle.
This object is used by serveCompiledFile.

One thing to keep in mind:
the sourcemap.sourcesContent will contains a json file transformed to js
while sourcesContent will contain the json file raw source because the corresponding
json file etag is used to invalidate the cache
*/

import { basename } from "path"
import { readFileSync } from "fs"
import { fileUrlToRelativePath, fileUrlToPath } from "internal/urlUtils.js"
import { writeOrUpdateSourceMappingURL } from "internal/sourceMappingURLUtils.js"
import { rollupIdToUrl } from "./generateBundle/createJsenvRollupPlugin/createJsenvRollupPlugin.js"

export const bundleToCompilationResult = (
  { rollupBundle, arrayOfAbstractUrl, moduleContentMap },
  { projectDirectoryUrl, sourcemapFileUrl, sourcemapFileRelativeUrlForModule },
) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }

  const sources = []
  const sourcesContent = []

  const trackDependencies = (dependencyMap) => {
    Object.keys(dependencyMap).forEach((moduleUrl) => {
      // do not track abstract dependency
      if (arrayOfAbstractUrl.includes(moduleUrl)) return
      // do not track dependency outside project
      if (!moduleUrl.startsWith(projectDirectoryUrl)) return

      // technically we are not relative to sourcemapFileUrl but rather
      // to the meta.json file url but they are at the same place
      const relativePath = fileUrlToRelativePath(moduleUrl, sourcemapFileUrl)
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
    arrayOfAbstractUrl,
    sourcemapFileRelativeUrlForModule,
  })
  trackDependencies(mainChunk.dependencyMap)
  assets.push(basename(fileUrlToPath(sourcemapFileUrl)))
  assetsContent.push(JSON.stringify(mainChunk.sourcemap, null, "  "))

  rollupBundle.output.slice(1).forEach((rollupChunk) => {
    const chunkFileName = rollupChunk.fileName
    const chunk = parseRollupChunk(rollupChunk, {
      moduleContentMap,
      arrayOfAbstractUrl,
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
    arrayOfAbstractUrl,
    moduleContentMap,
    sourcemapFileRelativeUrlForModule = `./${rollupChunk.fileName}.map`,
  },
) => {
  const dependencyMap = {}
  const moduleKeys = Object.keys(rollupChunk.modules)
  const mainModuleUrl = rollupIdToUrl(rollupChunk.facadeModuleId)
  const mainModuleSourcemap = rollupChunk.map

  moduleKeys.forEach((moduleId, moduleIndex) => {
    const moduleUrl = rollupIdToUrl(moduleId)
    dependencyMap[moduleUrl] = getModuleContent({
      arrayOfAbstractUrl,
      moduleContentMap,
      mainModuleUrl,
      mainModuleSourcemap,
      moduleUrl,
      moduleIndex,
    })
  })

  const sourcemap = rollupChunk.map

  const content = writeOrUpdateSourceMappingURL(rollupChunk.code, sourcemapFileRelativeUrlForModule)

  return {
    url: mainModuleUrl,
    dependencyMap,
    content,
    sourcemap,
  }
}

const getModuleContent = ({
  arrayOfAbstractUrl,
  moduleContentMap,
  mainModuleUrl,
  mainModuleSourcemap,
  moduleUrl,
  moduleIndex,
}) => {
  // try to get it from moduleContentMap
  if (moduleUrl in moduleContentMap) {
    return moduleContentMap[moduleUrl]
  }

  // otherwise try to read it from mainModuleSourcemap
  const sourcesContent = mainModuleSourcemap.sourcesContent || []
  if (moduleIndex in sourcesContent) {
    const contentFromRollupSourcemap = sourcesContent[moduleIndex]
    return {
      code: contentFromRollupSourcemap,
      raw: contentFromRollupSourcemap,
    }
  }

  // abstract ressource cannot be found, throw
  const isAbstract = arrayOfAbstractUrl.includes(moduleUrl)
  if (isAbstract) {
    throw new Error(`an abstract module content is missing in moduleContentMap.
--- module url ---
${moduleUrl}
--- main module url ---
${mainModuleUrl}`)
  }

  // try to get it from filesystem
  if (moduleUrl.startsWith("file:///")) {
    const moduleFilePath = fileUrlToPath(moduleUrl)
    // this could be async but it's ok for now
    // making it async could be harder than it seems
    // because sourcesContent must be in sync with sources
    try {
      const moduleFileBuffer = readFileSync(moduleFilePath)
      const moduleFileString = String(moduleFileBuffer)
      return {
        code: moduleFileString,
        raw: moduleFileString,
      }
    } catch (e) {
      if (e && e.code === "ENOENT") {
        throw new Error(`a module file cannot be found.
--- module file path ---
${moduleFilePath}
--- main module url ---
${mainModuleUrl}`)
      }
      throw e
    }
  }

  // it's an external ressource like http, throw
  throw new Error(`a remote module content is missing in moduleContentMap.
--- module url ---
${moduleUrl}
--- main module url ---
${mainModuleUrl}`)
}
