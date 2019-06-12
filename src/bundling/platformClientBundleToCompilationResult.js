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
  inlineSpecifierMap,
  entryRelativePath,
  sourcemapAssetPath,
  sourcemapPath = sourcemapAssetPath,
  bundle,
}) => {
  const output = bundle.output
  const main = output[0]

  const mainSourcemap = rollupSourcemapToCompilationSourcemap({
    rollupSourcemap: main.map,
    projectPathname,
    compileIntoRelativePath,
    entryRelativePath,
    inlineSpecifierMap,
  })

  const sources = mainSourcemap.sources
  const sourcesContent = mainSourcemap.sourcesContent
  const compiledSource = writeOrUpdateSourceMappingURL(main.code, sourcemapPath)
  const assets = [sourcemapAssetPath]
  const assetsContent = [JSON.stringify(mainSourcemap, null, "  ")]

  output.slice(1).forEach((chunk) => {
    const chunkSourcemap = rollupSourcemapToCompilationSourcemap({
      rollupSourcemap: chunk.map,
      projectPathname,
      compileIntoRelativePath,
      entryRelativePath,
      inlineSpecifierMap,
    })
    sources.push(...chunkSourcemap.sources) // we should avod duplication I guess
    sourcesContent.push(...chunkSourcemap.sourcesContent) // same here, avoid duplication

    assets.push(chunk.fileName)
    assetsContent.push(writeOrUpdateSourceMappingURL(chunk.code, `./${chunk.fileName}.map`))
    assets.push(`${chunk.fileName}.map`)
    assetsContent.push(JSON.stringify(chunkSourcemap, null, "  "))
  })

  return {
    contentType: "application/javascript",
    compiledSource,
    sources,
    sourcesContent,
    assets,
    assetsContent,
  }
}

const rollupSourcemapToCompilationSourcemap = ({
  rollupSourcemap,
  projectPathname,
  compileIntoRelativePath,
  entryRelativePath,
  inlineSpecifierMap,
}) => {
  const sources = []
  const sourcesContent = []
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

    if (
      sourceSpecifier in inlineSpecifierMap &&
      typeof inlineSpecifierMap[sourceSpecifier] === "function"
    ) {
      return
    }

    if (!pathnameIsInside(sourcePathname, projectPathname)) {
      throw new Error(`a source is not inside project
source: ${sourceRelativeToEntry}
source path: ${sourcePath}
project path: ${pathnameToOperatingSystemPath(projectPathname)}`)
    }

    const sourceRelativePath = pathnameToRelativePathname(sourcePathname, projectPathname)
    if (
      sourceRelativePath in inlineSpecifierMap &&
      typeof inlineSpecifierMap[sourceRelativePath] === "function"
    ) {
      return
    }

    sources.push(sourceRelativePath)
    if (rollupSourcemap.sourcesContent) {
      sourcesContent.push(rollupSourcemap.sourcesContent[index])
    } else {
      const sourcePath = `${projectPathname}${sourceRelativePath}`
      // this should be async but well this is ok for now
      const buffer = readFileSync(sourcePath)
      sourcesContent.push(String(buffer))
    }
  })

  // .json files are not added to map.sources by rollup
  // because inside jsenv-rollup-plugin we return an empty sourcemap
  // for json files.
  // we manually ensure they are registered as dependencies
  // to build the bundle
  Object.keys(inlineSpecifierMap).forEach((specifier) => {
    const specifierMapping = inlineSpecifierMap[specifier]
    if (
      typeof specifierMapping === "string" &&
      specifierMapping.endsWith(".json") &&
      specifierMapping.startsWith(`${projectPathname}/`)
    ) {
      const jsonFileRelativePath = pathnameToRelativePathname(specifierMapping, projectPathname)
      const expectedSource = jsonFileRelativePath.slice(1)
      const sourceIndex = sources.indexOf(expectedSource)
      if (sourceIndex === -1) {
        sources.push(jsonFileRelativePath)
        sourcesContent.push(String(readFileSync(pathnameToOperatingSystemPath(specifierMapping))))
      }
    }
  })

  const sourcemap = {
    ...rollupSourcemap,
    sources,
    sourcesContent,
  }

  return sourcemap
}
