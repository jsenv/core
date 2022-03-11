import { pathToFileUrl, fileURLToPath } from "node:url"
import { isFileSystemPath } from "@jsenv/filesystem"

import { createRessourceGraph } from "@jsenv/core/src/omega/ressource_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"
import { parseScriptNode } from "@jsenv/core/src/utils/html_ast/html_ast.js"

import { jsenvPluginAvoidVersioningCascade } from "./plugins/avoid_versioning_cascade/jsenv_plugin_avoid_versioning_cascade.js"

export const rollupPluginJsenv = ({
  signal,
  logger,
  projectDirectoryUrl,
  buildDirectoryUrl,
  entryPoints,
  plugins,
  runtimeSupport,
  sourcemapInjection,
  scenario,
}) => {
  let _rollupEmitFile = () => {
    throw new Error("not implemented")
  }
  let _rollupGetModuleInfo = () => {
    throw new Error("not implemented")
  }
  // rollup expects an input option, if we provide only an html file
  // without any script type module in it, we won't emit "chunk" and rollup will throw.
  // It is valid to build an html not referencing any js (rare but valid)
  // In that case jsenv emits an empty chunk and discards rollup warning about it
  // This chunk is later ignored in "generateBundle" hook
  let atleastOneChunkEmitted = false
  const emitChunk = (chunk) => {
    atleastOneChunkEmitted = true
    return _rollupEmitFile({
      type: "chunk",
      ...chunk,
    })
  }
  const rollupGetModuleInfo = (id) => _rollupGetModuleInfo(id)

  const ressourceGraph = createRessourceGraph({ projectDirectoryUrl })
  const kitchen = createKitchen({
    signal,
    logger,
    projectDirectoryUrl,
    scenario,
    plugins: [jsenvPluginAvoidVersioningCascade(), ...plugins],
    runtimeSupport,
    sourcemapInjection,
    ressourceGraph,
  })

  const urlsReferencedByJs = []
  const urlImporters = {}
  const cookedUrls = {}
  const assetUrls = []

  const cookUrl = ({ url, ...rest }) => {
    const cookedUrl = cookedUrls[url]
    if (cookedUrl) return cookedUrl
    const promise = kitchen.cookUrl({
      outDirectoryName: `${scenario}`,
      runtimeSupport,
      url,
      ...rest,
    })
    cookedUrls[url] = promise
    return promise
  }

  const cookEntryPoint = async (entryPointUrl) => {
    const entryPointContext = await cookUrl({
      outDirectoryName: `${scenario}`,
      runtimeSupport,
      parentUrl: projectDirectoryUrl,
      urlSite: null, // we could trace function calls
      url: entryPointUrl,
    })
    if (entryPointContext.error) {
      throw entryPointContext.error
    }
    return entryPointContext
  }

  const startCookingAsset = async ({ parentUrl, url, ...rest }) => {
    assetUrls.push(url)
    const urlSite = ressourceGraph.getUrlSite(parentUrl, url)
    const assetContext = await cookUrl({ parentUrl, urlSite, url, ...rest })
    if (assetContext.error) {
      throw assetContext.error
    }
    return assetContext
  }

  const cookJsModule = async (params) => {
    const jsModuleContext = await cookUrl(params)
    if (jsModuleContext.error) {
      throw jsModuleContext.error
    }
    return jsModuleContext
  }

  return {
    name: "jsenv",
    async buildStart() {
      _rollupEmitFile = (...args) => this.emitFile(...args)
      _rollupGetModuleInfo = (id) => this.getModuleInfo(id)

      await Object.keys(entryPoints).reduce(async (previous, key) => {
        await previous
        const entryPointRelativeUrl = key
        const entryPointUrl = kitchen.resolveSpecifier({
          parentUrl: projectDirectoryUrl,
          specifierType: "http_request", // not really but kinda
          specifier: entryPointRelativeUrl,
        })
        const entryPointContext = await cookEntryPoint(entryPointUrl)
        if (entryPointContext.type === "html") {
          let previousJsModuleId
          entryPointContext.urlMentions.forEach((urlMention) => {
            if (
              urlMention.type === "script_src" &&
              parseScriptNode(urlMention.node) === "module"
            ) {
              emitChunk({
                id: urlMention.url,
                implicitlyLoadedAfterOneOf: previousJsModuleId
                  ? [previousJsModuleId]
                  : [],
              })
              previousJsModuleId = urlMention.url
              return
            }
            startCookingAsset({
              parentUrl: entryPointContext.url,
              url: urlMention.url,
            })
          })
          return
        }
        if (entryPointContext.type === "js_module") {
          emitChunk({
            id: entryPointContext.url,
          })
          return
        }
        assetUrls.push(entryPointContext.url)
        entryPointContext.urlMentions.forEach((urlMention) => {
          startCookingAsset({
            parentUrl: entryPointContext.url,
            url: urlMention.url,
          })
        })
      }, Promise.resolve())
    },
    async generateBundle() {
      _rollupEmitFile = (...args) => this.emitFile(...args)
      await Promise.all(assetUrls.map((url) => cookedUrls[url]))
    },
    outputOptions: (outputOptions) => {
      Object.assign(outputOptions, {
        format: "esm",
        dir: fileURLToPath(buildDirectoryUrl),
        entryFileNames: () => {
          return `[name].js`
        },
        // assetFileNames: () => {
        //   return `assets/[name][extname]`
        // },
        chunkFileNames: () => {
          return `[name].js`
        },
      })
    },
    resolveId: (specifier, importer = projectDirectoryUrl) => {
      if (isFileSystemPath(importer)) {
        importer = pathToFileUrl(importer).href
      }
      const url = new URL(specifier, importer).href
      const existingImporter = urlImporters[url]
      if (!existingImporter) {
        urlImporters[url] = importer
      }
      if (!url.startsWith("file:")) {
        return { url, external: true }
      }
      return fileURLToPath(url)
    },
    async load(rollupId) {
      // here we know we are loading only js, assets are handled elsewhere right?
      const fileUrl = pathToFileUrl(rollupId).href
      const parentUrl = urlImporters[fileUrl] || projectDirectoryUrl
      const urlSite = ressourceGraph.getUrlSite(parentUrl, fileUrl)
      const { content, sourcemap } = await cookJsModule({
        parentUrl,
        urlSite,
        url: fileUrl,
        urlMentionHandlers: {
          js_import_meta_url_pattern: ({ urlMention, magicSource }) => {
            const urlSite = {
              url: fileUrl,
              line: urlMention.line,
              column: urlMention.column,
            }
            startCookingAsset({
              parentUrl: fileUrl,
              urlSite,
              url: urlMention.url,
            })
            urlsReferencedByJs.push(urlMention.url)
            // TODO: decide filename
            const { start, end } = urlMention.path.node
            magicSource.replace({
              start,
              end,
              replacement: `window.__asVersionedSpecifier__("./${fileName}")`,
            })
          },
        },
      })
      return {
        code: content,
        map: sourcemap,
      }
    },
    // resolveFileUrl: ({ moduleId, fileName }) => {
    //   urlsReferencedByJs.push(pathToFileUrl(moduleId).href)
    //   return `window.__resolveUrl__("./${fileName}", import.meta.url)`
    // },
    renderDynamicImport: ({ moduleId }) => {
      urlsReferencedByJs.push(pathToFileUrl(moduleId).href)
      return {
        left: "import(window.__asVersionedSpecifier__(",
        right: "), import.meta.url)",
      }
    },
  }
}
