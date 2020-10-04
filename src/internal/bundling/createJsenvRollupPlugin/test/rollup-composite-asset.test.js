import { createRequire } from "module"
import {
  urlToRelativeUrl,
  resolveUrl,
  urlToFileSystemPath,
  ensureEmptyDirectory,
  urlIsInsideOf,
  fileSystemPathToUrl,
} from "@jsenv/util"
import { createCompositeAssetHandler } from "../compositeAsset.js"
import { jsenvCompositeAssetHooks } from "../jsenvCompositeAssetHooks.js"
import { computeFileUrlForCaching } from "../computeFileUrlForCaching.js"

const require = createRequire(import.meta.url)

const { rollup } = require("rollup")

const projectDirectoryUrl = resolveUrl("./", import.meta.url)
const bundleDirectoryUrl = resolveUrl("./dist/", import.meta.url)
const inputFileUrl = resolveUrl("./main.js", import.meta.url)

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

  const compositeAssetPlugin = {
    async buildStart() {
      const rollup = this

      compositeAssetHandler = createCompositeAssetHandler(jsenvCompositeAssetHooks, {
        projectDirectoryUrl,
        connectReference: (reference) => {
          // ignore url outside project directory
          // a better version would console.warn about file url outside projectDirectoryUrl
          // and ignore them and console.info/debug about remote url (https, http, ...)
          if (!urlIsInsideOf(reference.url, projectDirectoryUrl)) {
            return
          }

          if (reference.type === "asset") {
            reference.connect(async ({ transformPromise }) => {
              let { code, urlForCaching } = await transformPromise

              if (urlForCaching === undefined) {
                urlForCaching = computeFileUrlForCaching(reference.url, code)
              }
              const rollupReferenceId = rollup.emitFile({
                type: "asset",
                source: code,
                fileName: urlToRelativeUrl(urlForCaching, projectDirectoryUrl),
              })
              return { rollupReferenceId, urlForCaching }
            })
          }

          if (reference.type === "js") {
            reference.connect(async () => {
              const jsRelativeUrl = `./${urlToRelativeUrl(reference.url, projectDirectoryUrl)}`
              const id = jsRelativeUrl
              if (typeof reference.source !== "undefined") {
                virtualModules[id] = reference.source
              }

              const rollupReferenceId = rollup.emitFile({
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

              await listenJsChunkCompleted(id)
              const urlForCaching = resolveUrl(
                rollup.getFileName(rollupReferenceId),
                projectDirectoryUrl,
              )
              return { rollupReferenceId, urlForCaching }
            })
          }
        },
      })
    },

    resolveId: (id) => {
      if (id in virtualModules) {
        return id
      }
      return null
    },

    load: async (id) => {
      if (id in virtualModules) {
        return virtualModules[id]
      }
      if (id.endsWith(".js")) {
        return null
      }
      const url = fileSystemPathToUrl(id)
      if (urlIsInsideOf(url, projectDirectoryUrl)) {
        const assetReferenceId = await compositeAssetHandler.getAssetReferenceId(
          fileSystemPathToUrl(id),
        )
        return `export default import.meta.ROLLUP_FILE_URL_${assetReferenceId};`
      }
      // external url are returned untouched
      return `export default ${JSON.stringify(url)}`
    },

    //   buildEnd: (error) => {
    //     if (error) {
    //       console.log(`error during rollup build
    // --- error stack ---
    // ${error.stack}`)
    //       return
    //     }
    //     // malheureusement rollup ne permet pas de savoir lorsqu'un chunk
    //     // a fini d'etre résolu (on connait ses dépendances etc)
    //     // donc lorsque le build se termine on va indiquer
    //     // aux assets faisant référence a ces chunk js qu'ils sont terminés
    //     // et donc les assets peuvent connaitre le nom du chunk
    //     // et mettre a jour leur dépendance vers ce fichier js
    //     Object.keys(jsChunkCompletedCallbackMap).forEach((key) => {
    //       jsChunkCompletedCallbackMap[key]()
    //     })
    //   },

    generateBundle: (bundle) => {
      console.log("generate bundle", bundle)
    },
  }

  const bundle = await rollup({
    input: urlToFileSystemPath(inputFileUrl),
    plugins: [compositeAssetPlugin],
  })

  await bundle.write({
    format: "esm",
    dir: urlToFileSystemPath(bundleDirectoryUrl),
  })
}

await generateBundle()
