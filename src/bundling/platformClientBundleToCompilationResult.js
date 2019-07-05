/*

platformClientBundleToCompilationResult does two things:

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

import { readFileSync } from "fs"
import { dirname, resolve } from "path"
import {
  pathnameToOperatingSystemPath,
  isWindowsPath,
  windowsPathToPathnameWithoutDriveLetter,
  pathnameIsInside,
  pathnameToRelativePathname,
  operatingSystemPathToPathname,
} from "@jsenv/operating-system-path"
import { writeOrUpdateSourceMappingURL } from "../source-mapping-url.js"

export const platformClientBundleToCompilationResult = ({
  projectPathname,
  compileIntoRelativePath,
  relativePathAbstractArray,
  entryRelativePath,
  sourcemapAssetPath,
  sourcemapPath = sourcemapAssetPath,
  bundle,
}) => {
  const sources = []
  const sourcesContent = []
  const assets = []
  const assetsContent = []

  const output = bundle.output
  const main = output[0]
  const mainRollupSourcemap = main.map

  const mainDependencyMap = rollupSourcemapToDependencyMap({
    rollupSourcemap: mainRollupSourcemap,
    projectPathname,
    compileIntoRelativePath,
    entryRelativePath,
    relativePathAbstractArray,
  })

  // main file
  const mainSourceContent = writeOrUpdateSourceMappingURL(main.code, sourcemapPath)
  // main sourcemap
  assets.push(sourcemapAssetPath.slice(2))
  const mainSourcemap = {
    ...mainRollupSourcemap,
    ...dependencyMapToSourcemapSubset(mainDependencyMap),
  }
  assetsContent.push(JSON.stringify(mainSourcemap, null, "  "))
  // main dependencies
  sources.push(...Object.keys(mainDependencyMap))
  sourcesContent.push(...Object.keys(mainDependencyMap).map((source) => mainDependencyMap[source]))

  output.slice(1).forEach((chunk) => {
    const chunkRollupSourcemap = chunk.map
    const chunkDependencyMap = rollupSourcemapToDependencyMap({
      rollupSourcemap: chunkRollupSourcemap,
      projectPathname,
      compileIntoRelativePath,
      entryRelativePath,
      relativePathAbstractArray,
    })

    // chunk file
    assets.push(chunk.fileName)
    const chunkSourceContent = writeOrUpdateSourceMappingURL(chunk.code, `./${chunk.fileName}.map`)
    assetsContent.push(chunkSourceContent)
    // chunk sourcemap
    assets.push(`${chunk.fileName}.map`)
    const chunkSourcemap = {
      ...chunkRollupSourcemap,
      ...dependencyMapToSourcemapSubset(chunkDependencyMap),
    }
    assetsContent.push(JSON.stringify(chunkSourcemap, null, "  "))
    // chunk dependencies
    Object.keys(chunkDependencyMap).forEach((chunkDependencyRelativePath) => {
      if (!sources.includes(chunkDependencyRelativePath)) {
        sources.push(chunkDependencyRelativePath)
        sourcesContent.push(chunkDependencyMap[chunkDependencyRelativePath])
      }
    })
  })

  return {
    contentType: "application/javascript",
    compiledSource: mainSourceContent,
    sources,
    sourcesContent,
    assets,
    assetsContent,
  }
}

const dependencyMapToSourcemapSubset = (dependencyMap) => {
  const sources = Object.keys(dependencyMap)
  const sourcesContent = sources.map((source) => {
    // for sourcemap the source content of a json file is the js
    // transformation of that json
    if (source.endsWith(".json")) return `export default ${dependencyMap[source]}`
    return dependencyMap[source]
  })
  return {
    sources,
    sourcesContent,
  }
}

const rollupSourcemapToDependencyMap = ({
  rollupSourcemap,
  projectPathname,
  compileIntoRelativePath,
  entryRelativePath,
  relativePathAbstractArray,
}) => {
  const dependencyMap = {}

  rollupSourcemap.sources.forEach((sourceRelativeToEntry, index) => {
    const sourcePath = resolve(
      dirname(
        pathnameToOperatingSystemPath(
          `${projectPathname}${compileIntoRelativePath}${entryRelativePath}`,
        ),
      ),
      sourceRelativeToEntry,
    )
    const sourcePathname = operatingSystemPathToPathname(sourcePath)
    const sourceSpecifier = isWindowsPath(sourcePath)
      ? windowsPathToPathnameWithoutDriveLetter(sourcePath)
      : sourcePath

    if (relativePathAbstractArray.includes(sourceSpecifier)) {
      return
    }

    if (!pathnameIsInside(sourcePathname, projectPathname)) {
      throw createSourceOutsideProjectError({
        source: sourceRelativeToEntry,
        sourcePath,
        projectPathname,
      })
    }

    const sourceRelativePath = pathnameToRelativePathname(sourcePathname, projectPathname)
    if (relativePathAbstractArray.includes(sourceRelativePath)) {
      return
    }

    let dependencyContent

    // .json file source content is not the one inside the file
    // because jsenv-rollup-plugin transforms it to
    // export default, so we must set back the
    // right file content
    if (sourceRelativePath.endsWith(".json") || !rollupSourcemap.sourcesContent) {
      const sourcePath = `${projectPathname}${sourceRelativePath}`
      // this could be async but it's ok for now
      // making it async could be harder than it seems
      // because sourcesContent must be in sync with sources
      const buffer = readFileSync(sourcePath)
      dependencyContent = String(buffer)
    } else {
      dependencyContent = rollupSourcemap.sourcesContent[index]
    }

    dependencyMap[sourceRelativePath] = dependencyContent
  })

  return dependencyMap
}

const createSourceOutsideProjectError = ({ source, sourcePath, projectPathname }) =>
  new Error(`a source is not inside project
source: ${source}
source path: ${sourcePath}
project path: ${pathnameToOperatingSystemPath(projectPathname)}`)
