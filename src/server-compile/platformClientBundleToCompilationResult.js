import { dirname, resolve } from "path"
import { existsSync, readFileSync } from "fs"
import { writeOrUpdateSourceMappingURL } from "../source-mapping-url.js"

export const platformClientBundleToCompilationResult = ({
  projectFolder,
  importMapFilenameRelative,
  compileInto,
  platformClientName,
  platformClientDataSpecifier,
  bundle,
}) => {
  const main = bundle.output[0]
  const mainSourcemap = main.map
  const sources = mainSourcemap.sources.map((sourceRelativeToEntryDirectory) => {
    const sourceFilename = resolve(
      dirname(`${projectFolder}/${compileInto}/${platformClientName}.js`),
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
  // BROWSER_CLIENT_DATA.js or NODE_CLIENT_DATA.js has no location on filesystem
  // it means cache validation would fail saying file does not exists
  // and would not be invalidated if something required by BROWSER_CLIENT_DATA.js
  // has changed.
  // BROWSER_CLIENT_DATA.js is generated thanks to importMapFilenameRelative
  // so we replace it with that file.
  const platformClientDataIndex = sources.indexOf(platformClientDataSpecifier)
  const importMapFilename = `${projectFolder}/${importMapFilenameRelative}`
  if (existsSync(importMapFilename)) {
    sources[platformClientDataIndex] = importMapFilenameRelative
    sourcesContent[platformClientDataIndex] = readFileSync(importMapFilename)
  } else {
    sources.splice(platformClientDataIndex, 1)
  }

  const sourcemapFilenameRelative = `${platformClientName}.js__asset__/${platformClientName}.js.map`
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
