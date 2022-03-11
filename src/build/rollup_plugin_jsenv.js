import { pathToFileUrl, fileURLToPath, pathToFileURL } from "node:url"
import { isFileSystemPath, urlToFilename } from "@jsenv/filesystem"

import { createRessourceGraph } from "@jsenv/core/src/omega/ressource_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"
import { parseScriptNode } from "@jsenv/core/src/utils/html_ast/html_ast.js"

import { createAvailableNameGenerator } from "./build_url_generator.js"
import { jsenvPluginAvoidVersioningCascade } from "./plugins/avoid_versioning_cascade/jsenv_plugin_avoid_versioning_cascade.js"

const EMPTY_CHUNK_URL = "virtual:__empty__"

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
  resultRef,
}) => {
  let _rollupEmitFile = () => {
    throw new Error("not implemented")
  }
  let _rollupGetModuleInfo = () => {
    throw new Error("not implemented")
  }
  const emitChunk = (chunk) => {
    return _rollupEmitFile({
      type: "chunk",
      ...chunk,
    })
  }
  const rollupGetModuleInfo = (id) => _rollupGetModuleInfo(id)

  const assetDirectoryUrl = new URL("./assets/", buildDirectoryUrl).href
  const availableNameGenerator = createAvailableNameGenerator()
  const urlsReferencedByJs = []
  const urlImporters = {}
  const cookedUrls = {}
  const assetUrls = []

  const urlMentionHandlers = {
    js_import_meta_url_pattern: ({ url, urlMention, magicSource }) => {
      const urlSite = {
        url,
        line: urlMention.line,
        column: urlMention.column,
      }
      startCookingAsset({
        parentUrl: url,
        urlSite,
        url: urlMention.url,
      })
      urlsReferencedByJs.push(urlMention.url)
      const assetName = availableNameGenerator.getAvailableNameInDirectory(
        urlToFilename(urlMention.url),
        assetDirectoryUrl,
      )
      const { start, end } = urlMention.path.node
      magicSource.replace({
        start,
        end,
        replacement: `window.__asVersionedSpecifier__("./${assetName}")`,
      })
    },
  }

  const ressourceGraph = createRessourceGraph({ projectDirectoryUrl })
  const kitchen = createKitchen({
    signal,
    logger,
    projectDirectoryUrl,
    scenario,
    plugins: [
      // {
      //   name: "jsenv:rollup",
      //   appliesDuring: "*",
      //   cooked: onCooked,
      // },
      jsenvPluginAvoidVersioningCascade(),
      ...plugins,
    ],
    runtimeSupport,
    sourcemapInjection,
    ressourceGraph,
  })

  const cookUrl = ({ url, ...rest }) => {
    const cookedUrl = cookedUrls[url]
    if (cookedUrl) return cookedUrl
    const promise = kitchen.cookUrl({
      outDirectoryName: `${scenario}`,
      runtimeSupport,
      url,
      urlMentionHandlers,
      ...rest,
    })
    cookedUrls[url] = promise
    return promise
  }

  const startCookingAsset = async ({ parentUrl, url, ...rest }) => {
    assetUrls.push(url)
    const urlTrace = ressourceGraph.getUrlTrace(url, parentUrl)
    const assetContext = await cookUrl({ parentUrl, urlTrace, url, ...rest })
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

      const htmlEntryPointsCooked = []
      const jsModuleEntryPointsCooked = []
      const assetEntryPointsCooked = []
      await Object.keys(entryPoints).reduce(async (previous, key) => {
        await previous
        const entryPointRelativeUrl = key
        const entryPointUrl = kitchen.resolveSpecifier({
          parentUrl: projectDirectoryUrl,
          specifierType: "http_request", // not really but kinda
          specifier: entryPointRelativeUrl,
        })
        const entryPointCooked = await cookUrl({
          outDirectoryName: `${scenario}`,
          runtimeSupport,
          parentUrl: projectDirectoryUrl,
          urlSite: null, // we could trace function calls
          url: entryPointUrl,
        })
        if (entryPointCooked.error) {
          throw entryPointCooked.error
        }
        if (entryPointCooked.type === "html") {
          htmlEntryPointsCooked.push(entryPointCooked)
          return
        }
        if (entryPointCooked.type === "js_module") {
          jsModuleEntryPointsCooked.push(entryPointCooked)
          return
        }
        assetEntryPointsCooked.push(entryPointCooked)
      }, Promise.resolve())
      // rollup expects an input option, if we provide only an html file
      // without any script type module in it, we won't emit "chunk" and rollup will throw.
      // It is valid to build an html not referencing any js (rare but valid)
      // In that case jsenv emits an empty chunk and discards rollup warning about it
      // This chunk is later ignored in "generateBundle" hook
      let atLeastOneChunkEmitted = false
      htmlEntryPointsCooked.forEach((htmlEntryPointCooked) => {
        let previousJsModuleId
        htmlEntryPointCooked.urlMentions.forEach((urlMention) => {
          if (
            urlMention.type === "script_src" &&
            parseScriptNode(urlMention.node) === "module"
          ) {
            atLeastOneChunkEmitted = true
            emitChunk({
              id: urlMention.url,
              implicitlyLoadedAfterOneOf: previousJsModuleId
                ? [previousJsModuleId]
                : [],
            })
            previousJsModuleId = urlMention.url
            return
          }
          // imaginons un link re="preload", on peut pas juste emit
          // l'asset sans prendre en compte ce qu'il référence
          // parce que si c'est du js de type module
          // (chose qu'on découvre ensuite an voyant un script type module par ex)
          // alors on a pas la bonne approche
          startCookingAsset({
            parentUrl: htmlEntryPointCooked.url,
            url: urlMention.url,
          })
        })
      })
      jsModuleEntryPointsCooked.forEach((jsModuleEntryPointCooked) => {
        emitChunk({
          id: jsModuleEntryPointCooked.url,
        })
        atLeastOneChunkEmitted = true
      })
      assetEntryPointsCooked.forEach((assetEntryPointCooked) => {
        assetUrls.push(assetEntryPointCooked.url)
        assetEntryPointCooked.urlMentions.forEach((urlMention) => {
          startCookingAsset({
            parentUrl: assetEntryPointCooked.url,
            url: urlMention.url,
          })
        })
      })
      if (!atLeastOneChunkEmitted) {
        emitChunk({
          id: EMPTY_CHUNK_URL,
          fileName: "__empty__",
        })
      }
    },
    async generateBundle(outputOptions, rollupResult) {
      _rollupEmitFile = (...args) => this.emitFile(...args)
      delete rollupResult["__empty__"]
      await Promise.all(assetUrls.map((url) => cookedUrls[url]))

      const buildFileContents = {}
      Object.keys(rollupResult).forEach((fileName) => {
        const rollupFileInfo = rollupResult[fileName]
        // there is 3 types of file: "placeholder", "asset", "chunk"
        if (rollupFileInfo.type === "chunk") {
          const { facadeModuleId } = rollupFileInfo
          if (facadeModuleId) {
            rollupFileInfo.url = pathToFileURL(facadeModuleId).href
          } else {
            const { sources } = rollupFileInfo.map
            const sourcePath = sources[sources.length - 1]
            rollupFileInfo.url = pathToFileURL(sourcePath).href
          }
        }
      })
      // on veut aussi itérer sur tous les assets pour les mettre dans "buildFileContents"
      resultRef.current = {
        buildFileContents,
      }
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
      if (specifier === EMPTY_CHUNK_URL) {
        return specifier
      }
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
      if (rollupId === EMPTY_CHUNK_URL) {
        return ""
      }
      // here we know we are loading only js, assets are handled elsewhere right?
      const fileUrl = pathToFileUrl(rollupId).href
      const parentUrl = urlImporters[fileUrl] || projectDirectoryUrl
      const urlTrace = ressourceGraph.getUrlTrace(parentUrl, fileUrl)
      const { content, sourcemap } = await cookJsModule({
        parentUrl,
        urlTrace,
        url: fileUrl,
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
    renderChunk: (code, chunkInfo) => {
      const { facadeModuleId } = chunkInfo
      if (!facadeModuleId) {
        // happens for inline module scripts for instance
        return null
      }
      if (facadeModuleId === EMPTY_CHUNK_URL) {
        return null
      }
      return null
    },
  }
}
