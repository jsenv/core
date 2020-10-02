/*
now let's test with a rollup bundle

we must ensure the following:

css files are written
css sourcemaps are written and can be found by browser
assets referenced only by css are written and path is correct
assets reference both by css and js have correct path in css and js; and not duplicated

a given rollup build generates an hash for the js file
then modifying only an asset file referenced both by js and css should update the js hash
*/

import { createRequire } from "module"
import { readFileSync } from "fs"
import {
  fileSystemPathToUrl,
  urlToRelativeUrl,
  resolveUrl,
  urlToFileSystemPath,
  readFile,
  ensureEmptyDirectory,
} from "@jsenv/util"
import { transformCss } from "../../transformCss.js"
import { computeFileUrlForCaching } from "../../computeFileUrlForCaching.js"

const require = createRequire(import.meta.url)

const { rollup } = require("rollup")

const projectDirectoryUrl = resolveUrl("./", import.meta.url)
const bundleDirectoryUrl = resolveUrl("./dist/", import.meta.url)
const inputFileUrl = resolveUrl("./main.js", import.meta.url)

const generateBundle = async () => {
  await ensureEmptyDirectory(bundleDirectoryUrl)

  // we share asset amission so that any reference to an asset
  // in css that was already referenced in js is shared.
  // and that any reference to an asset in js already referenced by css is shared.
  const assetReferencesByUrl = {}
  const emitAsset = (rollup, { assetFileUrl, assetFileUrlForRollup, assetFileContent }) => {
    if (assetFileUrl in assetReferencesByUrl) {
      return assetReferencesByUrl[assetFileUrl].assetReferenceId
    }
    if (assetFileUrlForRollup === undefined) {
      assetFileUrlForRollup = computeFileUrlForCaching(assetFileUrl, assetFileContent)
    }
    const assetFileName = urlToRelativeUrl(assetFileUrlForRollup, projectDirectoryUrl)
    const assetReferenceId = rollup.emitFile({
      type: "asset",
      fileName: assetFileName,
      source: assetFileContent,
    })
    assetReferencesByUrl[assetFileUrl] = {
      assetReferenceId,
      assetFileName,
    }
    return assetReferenceId
  }

  const getAssetReferenceId = (assetFileUrl) => {
    return assetFileUrl in assetReferencesByUrl
      ? assetReferencesByUrl[assetFileUrl].assetReferenceId
      : null
  }

  const cssAssetPlugin = {
    async load(id) {
      if (id.endsWith(".css")) {
        const cssFileUrl = fileSystemPathToUrl(id)
        const css = await readFile(cssFileUrl)
        const {
          assetUrlMappings,
          assetSources,
          cssUrlMappings,
          cssContentMappings,
        } = await transformCss(css, cssFileUrl, projectDirectoryUrl)

        // emit assets referenced by css (fonts, images, svgs, ...)
        Object.keys(assetSources).forEach((assetUrl) => {
          emitAsset(this, {
            assetFileUrl: assetUrl,
            assetFileUrlForRollup: assetUrlMappings[assetUrl],
            assetFileContent: assetSources[assetUrl],
          })
        })

        // emit css itself and css referenced by css (@import)
        Object.keys(cssContentMappings).forEach((cssUrl) => {
          emitAsset(this, {
            assetFileUrl: cssUrl,
            assetFileUrlForRollup: cssUrlMappings[cssUrl],
            assetFileContent: cssContentMappings[cssUrl].css,
          })

          const map = cssContentMappings[cssUrl].map
          const mapFileBundleRelativeUrl = urlToRelativeUrl(
            `${cssUrlMappings[cssUrl]}.map`,
            projectDirectoryUrl,
          )
          const mapFileBundleUrl = resolveUrl(mapFileBundleRelativeUrl, bundleDirectoryUrl)
          map.sources = map.sources.map((source) => {
            const sourceUrl = resolveUrl(source, projectDirectoryUrl)
            return urlToRelativeUrl(sourceUrl, mapFileBundleUrl)
          })
          this.emitFile({
            type: "asset",
            fileName: mapFileBundleRelativeUrl,
            source: JSON.stringify(cssContentMappings[cssUrl].map, null, "  "),
          })
        })
        const mainCssReference = getAssetReferenceId(cssFileUrl)
        return `export default import.meta.ROLLUP_FILE_URL_${mainCssReference};`
      }

      if (id.endsWith(".png")) {
        const assetUrl = fileSystemPathToUrl(id)
        const assetReferenceId = emitAsset(this, {
          assetFileUrl: assetUrl,
          assetFileContent: readFileSync(id),
        })
        return `export default import.meta.ROLLUP_FILE_URL_${assetReferenceId};`
      }

      return null
    },

    augmentChunkHash(chunk) {
      // pourquoi c'est jamais appelé?
      // c'est parce que y'a pas de chunk ici, y'a que un main chunk qui n'a pas de hash
      // donc ce sera appelé pour les chunks pas de souci
      // https://github.com/Anidetrix/rollup-plugin-styles/blob/7532971ed8e0a62206c970f336efaf1bcf5c3315/src/index.ts#L126
      debugger
    },

    resolveFileUrl: ({ chunkId, fileName, format, moduleId, referenceId, relativePath }) => {
      const fileUrl = fileSystemPathToUrl(moduleId)
      if (fileUrl in assetReferencesByUrl) {
        return JSON.stringify(assetReferencesByUrl[fileUrl].assetFileName)
      }
      return JSON.stringify(fileName)
    },
  }
  const bundle = await rollup({
    input: urlToFileSystemPath(inputFileUrl),
    plugins: [cssAssetPlugin],
  })

  await bundle.write({
    format: "esm",
    dir: urlToFileSystemPath(bundleDirectoryUrl),
  })
}

await generateBundle()
