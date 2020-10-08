import { createRequire } from "module"
import { readFileSync } from "fs"

import {
  urlToRelativeUrl,
  resolveUrl,
  urlToFileSystemPath,
  ensureEmptyDirectory,
  urlIsInsideOf,
  fileSystemPathToUrl,
  isFileSystemPath,
} from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
import { createCompositeAssetHandler } from "../compositeAsset.js"
import { jsenvCompositeAssetHooks } from "../jsenvCompositeAssetHooks.js"
import { computeFileUrlForCaching } from "../computeFileUrlForCaching.js"

const require = createRequire(import.meta.url)

const { rollup } = require("rollup")

const projectDirectoryUrl = resolveUrl("./", import.meta.url)
const bundleDirectoryUrl = resolveUrl("./dist/", import.meta.url)
const inputFileUrl = resolveUrl("./index.html", import.meta.url)

const logger = createLogger({ logLevel: "debug" })

const generateBundle = async () => {
  await ensureEmptyDirectory(bundleDirectoryUrl)

  let compositeAssetHandler

  const virtualModules = {}
  const jsChunkCompletedPromiseMap = {}
  const jsChunkCompletedCallbackMap = {}
  const listenJsChunkCompleted = (id) => {
    if (id in jsChunkCompletedPromiseMap) {
      return jsChunkCompletedPromiseMap[id]
    }
    const promise = new Promise((resolve) => {
      jsChunkCompletedCallbackMap[id] = resolve
    })
    jsChunkCompletedPromiseMap[id] = promise
    return promise
  }

  const shortenUrl = (url) => {
    return urlIsInsideOf(url, projectDirectoryUrl)
      ? urlToRelativeUrl(url, projectDirectoryUrl)
      : url
  }

  const formatReferenceForLog = ({ url, importerUrl }) => {
    if (importerUrl) {
      return `reference to ${shortenUrl(url)} in ${shortenUrl(importerUrl)}`
    }
    return `reference to ${shortenUrl(url)}`
  }

  const importerMapping = {}
  const assetPendingUrls = []

  let emitFile = () => {}

  const compositeAssetPlugin = {
    async buildStart() {
      emitFile = (...args) => this.emitFile(...args)

      compositeAssetHandler = createCompositeAssetHandler(jsenvCompositeAssetHooks, {
        projectDirectoryUrl,
        connectReference: (reference) => {
          // ignore url outside project directory
          // a better version would console.warn about file url outside projectDirectoryUrl
          // and ignore them and console.info/debug about remote url (https, http, ...)
          if (!urlIsInsideOf(reference.url, projectDirectoryUrl)) {
            logger.debug(`found external ${formatReferenceForLog(reference)} -> ignored`)
            return
          }

          if (reference.type === "asset") {
            if (reference.isInline) {
              logger.debug(`found inline asset ${formatReferenceForLog(reference)}`)
            } else {
              logger.debug(`found asset ${formatReferenceForLog(reference)}`)
            }

            reference.connect(async ({ transformPromise }) => {
              let { code, urlForCaching } = await transformPromise

              if (urlForCaching === undefined) {
                urlForCaching = computeFileUrlForCaching(reference.url, code)
              }
              logger.debug(`emit asset for ${formatReferenceForLog(reference)}`)
              const rollupReferenceId = emitFile({
                type: "asset",
                source: code,
                fileName: urlToRelativeUrl(urlForCaching, projectDirectoryUrl),
              })
              logger.debug(`${shortenUrl(reference.url)} ready -> ${shortenUrl(urlForCaching)}`)
              return { rollupReferenceId, urlForCaching }
            })
          }

          if (reference.type === "js") {
            // it's not possible yet to dynamically emit a chunk from an asset
            // https://github.com/rollup/rollup/issues/2872
            if (reference.importerUrl !== inputFileUrl) {
              logger.warn(
                `cannot handle js ${formatReferenceForLog(
                  reference,
                )} because it's not yet supported by rollup`,
              )
              return
            }

            if (reference.isInline) {
              logger.debug(`found inline js ${formatReferenceForLog(reference)}`)
            } else {
              logger.debug(`found js ${formatReferenceForLog(reference)}`)
            }

            reference.connect(async () => {
              const jsRelativeUrl = `./${urlToRelativeUrl(reference.url, projectDirectoryUrl)}`
              const id = jsRelativeUrl
              if (typeof reference.source !== "undefined") {
                virtualModules[id] = reference.source
              }

              logger.debug(`emit chunk for ${formatReferenceForLog(reference)}`)
              const rollupReferenceId = emitFile({
                type: "chunk",
                id,
                ...(reference.previousJsReference
                  ? {
                      implicitlyLoadedAfterOneOf: [
                        `./${urlToRelativeUrl(
                          reference.previousJsReference.url,
                          projectDirectoryUrl,
                        )}`,
                      ],
                    }
                  : {}),
              })

              // ideally we would not rely on reference.url
              // because resolveId (importmap) could redirect it somewhere else
              // we'll see about that later when adding importmap back
              assetPendingUrls.push(reference.importerUrl)
              const { urlForCaching } = await listenJsChunkCompleted(reference.url)
              return { rollupReferenceId, urlForCaching }
            })
          }
        },
      })

      compositeAssetHandler.getAssetReferenceId(inputFileUrl)
    },

    resolveId: (specifier, importer = projectDirectoryUrl) => {
      if (specifier in virtualModules) {
        return specifier
      }
      if (isFileSystemPath(importer)) {
        importer = fileSystemPathToUrl(importer)
      }
      const url = resolveUrl(specifier, importer)
      // keep external url intact
      if (!urlIsInsideOf(url, "file:///")) {
        return { id: specifier, external: true }
      }
      if (importer !== projectDirectoryUrl) {
        importerMapping[url] = importer
      }
      return url
    },

    load: async (id) => {
      if (id in virtualModules) {
        return virtualModules[id]
      }
      if (id.endsWith(".js")) {
        return String(readFileSync(urlToFileSystemPath(id)))
      }
      const importer = importerMapping[id]

      if (importer) {
        const assetReferenceId = await compositeAssetHandler.getAssetReferenceId(id, {
          importerUrl: importer,
        })
        return `export default import.meta.ROLLUP_FILE_URL_${assetReferenceId};`
      }

      compositeAssetHandler.getAssetReferenceId(id)
      return { code: "" }
    },

    renderChunk: (
      code,
      chunk,
      // options
    ) => {
      // malheureusement rollup ne permet pas de savoir lorsqu'un chunk
      // a fini d'etre résolu (on connait ses dépendances etc)
      // donc lorsque le build se termine on va indiquer
      // aux assets faisant référence a ces chunk js qu'ils sont terminés
      // et donc les assets peuvent connaitre le nom du chunk
      // et mettre a jour leur dépendance vers ce fichier js
      // const chunkUrl = chunk.facadeModuleId
      // if (chunkUrl in jsChunkCompletedCallbackMap) {
      //   jsChunkCompletedCallbackMap[chunkUrl]({
      //     code,
      //     urlForCaching: resolveUrl(chunk.fileName, projectDirectoryUrl),
      //   })
      // }
      return null
    },

    async generateBundle(options, bundle) {
      emitFile = (...args) => this.emitFile(...args)

      Object.keys(jsChunkCompletedCallbackMap).forEach((key) => {
        const chunkName = Object.keys(bundle).find(
          (bundleKey) => bundle[bundleKey].facadeModuleId === key,
        )
        const chunk = bundle[chunkName]
        jsChunkCompletedCallbackMap[key]({
          code: chunk.code,
          urlForCaching: resolveUrl(chunk.fileName, projectDirectoryUrl),
        })
      })

      await Promise.all(
        assetPendingUrls.map((assetPendingUrl) => {
          return compositeAssetHandler.getAssetReferenceId(assetPendingUrl)
        }),
      )
    },
  }

  const bundle = await rollup({
    input: [],
    plugins: [compositeAssetPlugin],
  })

  await bundle.write({
    format: "esm",
    dir: urlToFileSystemPath(bundleDirectoryUrl),
  })
}

await generateBundle()
