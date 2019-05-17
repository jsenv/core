import { readFileSync } from "fs"
import { dirname, resolve } from "path"
import { writeOrUpdateSourceMappingURL } from "../source-mapping-url.js"

export const platformClientBundleToCompilationResult = ({
  projectPathname,
  sourceRelativePath,
  compileIntoRelativePath,
  sourcemapRelativePath,
  inlineSpecifierMap,
  bundle,
}) => {
  const output = bundle.output
  const main = output[0]

  const mainSourcemap = rollupSourcemapToCompilationSourcemap({
    rollupSourcemap: main.map,
    projectPathname,
    compileIntoRelativePath,
    sourceRelativePath,
    inlineSpecifierMap,
  })

  const sources = mainSourcemap.sources
  const sourcesContent = mainSourcemap.sourcesContent
  const compiledSource = writeOrUpdateSourceMappingURL(
    main.code,
    `./${sourcemapRelativePath.slice(1)}`,
  )
  const assets = [sourcemapRelativePath.slice(1)]
  const assetsContent = [JSON.stringify(mainSourcemap, null, "  ")]

  output.slice(1).forEach((chunk) => {
    const chunkSourcemap = rollupSourcemapToCompilationSourcemap({
      rollupSourcemap: chunk.map,
      projectPathname,
      compileIntoRelativePath,
      sourceRelativePath,
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
  sourceRelativePath,
  inlineSpecifierMap,
}) => {
  const sources = []
  const sourcesContent = []
  rollupSourcemap.sources.forEach((sourceRelativeToEntryDirectory, index) => {
    const sourceFilename = resolve(
      dirname(`${projectPathname}${compileIntoRelativePath}${sourceRelativePath}`),
      sourceRelativeToEntryDirectory,
    )

    if (
      sourceFilename in inlineSpecifierMap &&
      typeof inlineSpecifierMap[sourceFilename] === "function"
    ) {
      return
    }

    if (!sourceFilename.startsWith(`${projectPathname}/`)) {
      throw new Error(`a source is not inside project
source: ${sourceRelativeToEntryDirectory}
sourceFilename: ${sourceFilename}
projectFolder: ${projectPathname}`)
    }

    const sourceRelativeToProjectFolder = sourceFilename.slice(`${projectPathname}/`.length)
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
      specifierMapping.startsWith(`${projectPathname}/`)
    ) {
      const expectedSource = specifierMapping.slice(`${projectPathname}/`.length)
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
