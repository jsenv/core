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

import { basename } from "path"
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

const require = createRequire(import.meta.url)

const { rollup } = require("rollup")

const projectDirectoryUrl = resolveUrl("./", import.meta.url)
const bundleDirectoryUrl = resolveUrl("./dist/", import.meta.url)
const inputFileUrl = resolveUrl("./main.js", import.meta.url)

const generateBundle = async () => {
  await ensureEmptyDirectory(bundleDirectoryUrl)
  const assetReferencesByUrl = {}

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
        } = await transformCss(css, {
          cssFileUrl,
          projectDirectoryUrl,
          bundleDirectoryUrl,
        })

        // emit assets referenced by css
        Object.keys(assetSources).forEach((assetUrl) => {
          const fileName = urlToRelativeUrl(assetUrlMappings[assetUrl], bundleDirectoryUrl)

          const assetReferenceId = this.emitFile({
            type: "asset",
            fileName,
            source: assetSources[assetUrl],
          })
          assetReferencesByUrl[assetUrl] = {
            assetReferenceId,
            fileName,
          }
        })

        // emit css referenced by css and css itself
        Object.keys(cssContentMappings).forEach((cssUrl) => {
          const fileName = urlToRelativeUrl(cssUrlMappings[cssUrl], projectDirectoryUrl)
          const assetReferenceId = this.emitFile({
            type: "asset",
            fileName,
            source: cssContentMappings[cssUrl].css,
          })
          assetReferencesByUrl[cssUrl] = {
            assetReferenceId,
            fileName,
          }

          // TODO: the css sourcemap url are incorrect because
          // they will be moved into bundleDirectoryUrl
          // we must re-resolve them
          this.emitFile({
            type: "asset",
            fileName: `${fileName}.map`,
            source: JSON.stringify(cssContentMappings[cssUrl].map, null, "  "),
          })
        })
        debugger
        const mainCssReference = assetReferencesByUrl[cssFileUrl].assetReferenceId
        return `export default import.meta.ROLLUP_FILE_URL_${mainCssReference};`
      }

      if (id.endsWith(".png")) {
        const assetUrl = fileSystemPathToUrl(id)
        let assetReferenceId
        if (assetUrl in assetReferencesByUrl) {
          assetReferenceId = assetReferencesByUrl[assetUrl].referenceId
        } else {
          const buffer = readFileSync(id)
          assetReferenceId = this.emitFile({
            type: "asset",
            name: basename(id),
            source: buffer,
          })
        }
        return `export default import.meta.ROLLUP_FILE_URL_${assetReferenceId};`
      }

      return null
    },

    augmentChunkHash(chunk) {
      // https://github.com/Anidetrix/rollup-plugin-styles/blob/7532971ed8e0a62206c970f336efaf1bcf5c3315/src/index.ts#L126

      debugger
    },

    // dans generateBundle il faudrait supprimer les assets référencé par le js

    resolveFileUrl: ({ chunkId, fileName, format, moduleId, referenceId, relativePath }) => {
      const fileUrl = fileSystemPathToUrl(moduleId)
      if (fileUrl in assetReferencesByUrl) {
        return JSON.stringify(assetReferencesByUrl[fileUrl].fileName)
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
