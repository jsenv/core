import { readFileSync } from "fs"
import { dirname, resolve } from "path"
import { writeOrUpdateSourceMappingURL } from "../source-mapping-url.js"

export const platformClientBundleToCompilationResult = ({
  projectFolder,
  compileInto,
  sourceFilenameRelative,
  inlineSpecifierMap,
  bundle,
  sourcemapFilenameRelative,
}) => {
  const output = bundle.output
  const main = output[0]

  const mainSourcemap = rollupSourcemapToCompilationSourcemap({
    rollupSourcemap: main.map,
    projectFolder,
    compileInto,
    sourceFilenameRelative,
    inlineSpecifierMap,
  })

  const sources = mainSourcemap.sources
  const sourcesContent = mainSourcemap.sourcesContent
  const compiledSource = writeOrUpdateSourceMappingURL(main.code, `./${sourcemapFilenameRelative}`)
  const assets = [sourcemapFilenameRelative]
  const assetsContent = [JSON.stringify(mainSourcemap, null, "  ")]

  output.slice(1).forEach((chunk) => {
    const chunkSourcemap = rollupSourcemapToCompilationSourcemap({
      rollupSourcemap: chunk.map,
      projectFolder,
      compileInto,
      sourceFilenameRelative,
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
  projectFolder,
  compileInto,
  sourceFilenameRelative,
  inlineSpecifierMap,
}) => {
  const sources = []
  const sourcesContent = []
  rollupSourcemap.sources.forEach((sourceRelativeToEntryDirectory, index) => {
    const sourceFilename = resolve(
      dirname(`${projectFolder}/${compileInto}/${sourceFilenameRelative}`),
      sourceRelativeToEntryDirectory,
    )

    if (
      sourceFilename in inlineSpecifierMap &&
      typeof inlineSpecifierMap[sourceFilename] === "function"
    ) {
      return
    }

    if (!sourceFilename.startsWith(`${projectFolder}/`)) {
      throw new Error(`a source is not inside project
source: ${sourceRelativeToEntryDirectory}
sourceFilename: ${sourceFilename}
projectFolder: ${projectFolder}`)
    }

    const sourceRelativeToProjectFolder = sourceFilename.slice(`${projectFolder}/`.length)
    const source = `/${sourceRelativeToProjectFolder}`

    if (source in inlineSpecifierMap && typeof inlineSpecifierMap[sourceFilename] === "function") {
      return
    }

    sources.push(source)
    sourcesContent.push(rollupSourcemap.sourcesContent[index])
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
      specifierMapping.startsWith(`${projectFolder}/`)
    ) {
      const expectedSource = specifierMapping.slice(`${projectFolder}/`.length)
      const sourceIndex = sources.indexOf(expectedSource)
      if (sourceIndex === -1) {
        sources.push(expectedSource)
        sourcesContent.push(String(readFileSync(specifierMapping)))
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
