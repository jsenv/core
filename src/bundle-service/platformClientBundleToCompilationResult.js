import { readFileSync } from "fs"
import { dirname, resolve, basename } from "path"
import { writeOrUpdateSourceMappingURL } from "../source-mapping-url.js"

export const platformClientBundleToCompilationResult = ({
  projectFolder,
  compileInto,
  filenameRelative,
  inlineSpecifierMap,
  bundle,
}) => {
  const main = bundle.output[0]
  const mainSourcemap = main.map

  const sources = []
  const sourcesContent = []
  mainSourcemap.sources.forEach((sourceRelativeToEntryDirectory, index) => {
    const sourceFilename = resolve(
      dirname(`${projectFolder}/${compileInto}/${filenameRelative}`),
      sourceRelativeToEntryDirectory,
    )

    if (
      sourceFilename in inlineSpecifierMap &&
      typeof inlineSpecifierMap[sourceFilename] === "function"
    ) {
      return
    }

    const sourceRelativeToProjectFolder = sourceFilename.slice(`${projectFolder}/`.length)
    const source = `/${sourceRelativeToProjectFolder}`

    if (source in inlineSpecifierMap && typeof inlineSpecifierMap[sourceFilename] === "function") {
      return
    }

    sources.push(source)
    sourcesContent.push(mainSourcemap.sourcesContent[index])
  })
  const sourcemap = {
    ...mainSourcemap,
    sources,
    sourcesContent,
  }

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

  const entryBasename = basename(filenameRelative)
  const sourcemapFilenameRelative = `${entryBasename}__asset__/${entryBasename}.map`
  const compiledSource = writeOrUpdateSourceMappingURL(main.code, `./${sourcemapFilenameRelative}`)

  return {
    contentType: "application/javascript",
    compiledSource,
    sources,
    sourcesContent,
    assets: [sourcemapFilenameRelative],
    assetsContent: [JSON.stringify(sourcemap, null, "  ")],
  }
}
