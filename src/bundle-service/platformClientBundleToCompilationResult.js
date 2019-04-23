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
  const sources = mainSourcemap.sources.map((sourceRelativeToEntryDirectory) => {
    const sourceFilename = resolve(
      dirname(`${projectFolder}/${compileInto}/${filenameRelative}`),
      sourceRelativeToEntryDirectory,
    )
    const sourceRelativeToProjectFolder = sourceFilename.slice(`${projectFolder}/`.length)
    return sourceRelativeToProjectFolder
  })
  const sourcemap = {
    ...mainSourcemap,
    sources: sources.map((source) => `/${source}`),
  }

  const sourcesContent = mainSourcemap.sourcesContent.slice()

  Object.keys(inlineSpecifierMap).forEach((specifier) => {
    const specifierMapping = inlineSpecifierMap[specifier]

    // .json files are not added to map.sources by rollup
    // because inside jsenv-rollup-plugin we return an empty sourcemap
    // for json files.
    // we manually ensure they are registered as dependencies
    // to build the bundle
    if (
      typeof specifierMapping === "string" &&
      specifierMapping.endsWith(".json") &&
      specifierMapping.startsWith(`${projectFolder}/`)
    ) {
      const expectedSource = specifierMapping.slice(`${projectFolder}/`.length)
      const sourceIndex = sources.indexOf(expectedSource)
      //
      if (sourceIndex === -1) {
        sources.push(expectedSource)
        sourcesContent.push(String(readFileSync(specifierMapping)))
      }
    }

    // they are dynamic sources, they have no real location
    // on filesystem
    if (typeof specifierMapping === "function") {
      const sourceIndex = sources.indexOf(specifier)

      if (sourceIndex > -1) {
        sources.splice(sourceIndex, 1)
        sourcesContent.splice(sourceIndex, 1)
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
