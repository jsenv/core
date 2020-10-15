/**
 * a faire
 *
 * - <img>
 * - xlink:href="" in svg
 * in theory inline style attributes
 * - <source> inside <audio>, <video>, <srcset>
 */

/* eslint-disable import/max-dependencies */
import { normalizeImportMap, resolveImport } from "@jsenv/import-map"
import {
  isFileSystemPath,
  fileSystemPathToUrl,
  resolveUrl,
  urlToRelativeUrl,
  resolveDirectoryUrl,
  writeFile,
  comparePathnames,
  urlIsInsideOf,
} from "@jsenv/util"

import { setJavaScriptSourceMappingUrl } from "../../sourceMappingURLUtils.js"
import { fetchUrl } from "../../fetchUrl.js"
import { validateResponseStatusIsOk } from "../../validateResponseStatusIsOk.js"
import { transformJs } from "../../compiling/js-compilation-service/transformJs.js"
import { findAsyncPluginNameInBabelPluginMap } from "../../compiling/js-compilation-service/findAsyncPluginNameInBabelPluginMap.js"
import {
  parseHtmlString,
  htmlAstContains,
  htmlNodeIsScriptModule,
  manipulateHtmlAst,
  findFirstImportmapNode,
  getHtmlNodeLocation,
  getHtmlNodeAttributeValue,
  getHtmlNodeTextContent,
} from "../../compiling/compileHtml.js"
import { showSourceLocation } from "./showSourceLocation.js"

import { isBareSpecifierForNativeNodeModule } from "./isBareSpecifierForNativeNodeModule.js"
import { fetchSourcemap } from "./fetchSourcemap.js"
import { minifyJs } from "./minifyJs.js"

import { createCompositeAssetHandler } from "./compositeAsset.js"
import { parseHtmlAsset } from "./parseHtmlAsset.js"
import { parseCssAsset } from "./parseCssAsset.js"
import { parseImportmapAsset } from "./parseImportmapAsset.js"
import { parseJsAsset } from "./parseJsAsset.js"
import { getTargetAsBase64Url } from "./getTargetAsBase64Url.js"

export const createJsenvRollupPlugin = async ({
  cancellationToken,
  logger,

  entryPointMap,
  projectDirectoryUrl,
  importMapFileRelativeUrl,
  compileDirectoryRelativeUrl,
  compileServerOrigin,
  importDefaultExtension,
  externalImportSpecifiers,
  babelPluginMap,
  node,
  browser,

  format,
  systemJsUrl,
  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,
  manifestFile,

  bundleDirectoryUrl,
  detectAndTransformIfNeededAsyncInsertedByRollup = format === "global",
}) => {
  // simplify this to track only raw content because we care only about this
  // and deprecate for urlSourceMapping
  const moduleContentMap = {}
  // rename urlRedirectionMapping = {}
  const redirectionMap = {}

  const EMPTY_CHUNK_URL = resolveUrl("__empty__", projectDirectoryUrl)

  const compileDirectoryUrl = resolveDirectoryUrl(compileDirectoryRelativeUrl, projectDirectoryUrl)
  const compileDirectoryRemoteUrl = resolveDirectoryUrl(
    compileDirectoryRelativeUrl,
    compileServerOrigin,
  )

  const nativeModulePredicate = (specifier) => {
    if (node && isBareSpecifierForNativeNodeModule(specifier)) return true
    // for now browser have no native module
    // and we don't know how we will handle that
    if (browser) return false
    return false
  }

  const urlImporterMapping = {}
  const urlResponseBodyMap = {}
  const virtualModules = {}

  const fetchImportmapFromParameter = async () => {
    const importmapProjectUrl = resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl)
    const importMapFileCompiledUrl = resolveUrl(importMapFileRelativeUrl, compileDirectoryRemoteUrl)
    const importMap = await fetchAndNormalizeImportmap(importMapFileCompiledUrl)
    logger.debug(`use importmap found following importMapRelativeUrl at ${importmapProjectUrl}`)
    return importMap
  }

  let compositeAssetHandler
  let emitFile = () => {}
  let fetchImportmap = fetchImportmapFromParameter
  let importMap
  const jsenvRollupPlugin = {
    name: "jsenv",

    async buildStart() {
      emitFile = (...args) => this.emitFile(...args)

      // https://github.com/easesu/rollup-plugin-html-input/blob/master/index.js
      // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string

      const entryPointsPrepared = []
      await Promise.all(
        Object.keys(entryPointMap).map(async (key) => {
          const projectRelativeUrl = key
          const chunkFileRelativeUrl = entryPointMap[key]
          const chunkFileUrl = resolveUrl(chunkFileRelativeUrl, bundleDirectoryUrl)
          const chunkName = urlToRelativeUrl(chunkFileUrl, bundleDirectoryUrl)

          if (projectRelativeUrl.endsWith(".html")) {
            const htmlProjectUrl = resolveUrl(projectRelativeUrl, projectDirectoryUrl)
            const htmlServerUrl = resolveUrl(projectRelativeUrl, compileServerOrigin)
            const htmlCompiledUrl = resolveUrl(projectRelativeUrl, compileDirectoryRemoteUrl)
            const htmlResponse = await fetchModule(htmlServerUrl, `entryPointMap`)
            const htmlSource = await htmlResponse.text()
            const importmapHtmlNode = findFirstImportmapNode(htmlSource)
            if (importmapHtmlNode) {
              if (fetchImportmap === fetchImportmapFromParameter) {
                const src = getHtmlNodeAttributeValue(importmapHtmlNode, "src")
                if (src) {
                  logger.info(formatUseImportMap(importmapHtmlNode, htmlProjectUrl, htmlSource))
                  const importmapUrl = resolveUrl(src, htmlCompiledUrl)
                  fetchImportmap = () => fetchAndNormalizeImportmap(importmapUrl)
                } else {
                  const text = getHtmlNodeTextContent(importmapHtmlNode)
                  if (text) {
                    logger.info(formatUseImportMap(importmapHtmlNode, htmlProjectUrl, htmlSource))
                    fetchImportmap = () => {
                      const importmapRaw = JSON.parse(text)
                      const importmap = normalizeImportMap(importmapRaw, htmlCompiledUrl)
                      return importmap
                    }
                  }
                }
              } else {
                logger.warn(formatIgnoreImportMap(importmapHtmlNode, htmlProjectUrl, htmlSource))
              }
            }

            entryPointsPrepared.push({
              type: "html",
              url: htmlServerUrl,
              chunkName,
              source: htmlSource,
            })
          } else {
            entryPointsPrepared.push({
              type: "js",
              url: resolveUrl(projectRelativeUrl, projectDirectoryUrl),
              chunkName,
            })
          }
        }),
      )
      importMap = await fetchImportmap()

      // rollup will yell at us telling we did not provide an input option
      // if we provide only an html file without any script type module in it
      // but this can be desired to produce a bundle with only assets (html, css, images)
      // without any js
      // we emit an empty chunk, discards rollup warning about it and we manually remove
      // this chunk in generateBundle hook
      let atleastOneChunkEmitted = false
      compositeAssetHandler = createCompositeAssetHandler(
        {
          parse: async (target, notifiers) => {
            const { url } = target
            if (url.endsWith(".html")) {
              return parseHtmlAsset(
                {
                  ...target,
                  url: urlToOriginalProjectUrl(url),
                },
                notifiers,
                {
                  minify,
                  minifyHtmlOptions,
                  htmlStringToHtmlAst: (htmlString) => {
                    const htmlAst = parseHtmlString(htmlString)
                    if (format !== "systemjs") {
                      return htmlAst
                    }

                    const htmlContainsModuleScript = htmlAstContains(
                      htmlAst,
                      htmlNodeIsScriptModule,
                    )
                    if (!htmlContainsModuleScript) {
                      return htmlAst
                    }

                    manipulateHtmlAst(htmlAst, {
                      scriptInjections: [
                        {
                          src: systemJsUrl,
                        },
                      ],
                    })
                    return htmlAst
                  },
                },
              )
            }

            if (url.endsWith(".css")) {
              return parseCssAsset(
                {
                  ...target,
                  url: urlToOriginalProjectUrl(url),
                },
                notifiers,
                { minify, minifyCssOptions },
              )
            }

            if (url.endsWith(".importmap")) {
              return parseImportmapAsset(
                {
                  ...target,
                  url: urlToOriginalProjectUrl(url),
                },
                notifiers,
              )
            }

            if (url.endsWith(".js")) {
              return parseJsAsset(
                {
                  ...target,
                  url: urlToOriginalProjectUrl(url),
                },
                notifiers,
                { minify, minifyJsOptions },
              )
            }

            return null
          },
          fetch: async (url, importerUrl) => {
            const moduleResponse = await fetchModule(url, importerUrl)
            return moduleResponse
          },
        },
        {
          projectDirectoryUrl: `${compileServerOrigin}`,
          bundleDirectoryUrl: resolveUrl(
            urlToRelativeUrl(bundleDirectoryUrl, projectDirectoryUrl),
            compileServerOrigin,
          ),
          urlToOriginalProjectUrl,
          loadUrl: (url) => urlResponseBodyMap[url],
          resolveTargetUrl: ({ specifier, isAsset }, target) => {
            if (target.isEntry && target.isAsset && !isAsset) {
              // html entry point
              // when html references a js we must wait for the compiled version of js
              const htmlCompiledUrl = urlToCompiledUrl(target.url)
              const jsAssetUrl = resolveUrl(specifier, htmlCompiledUrl)
              return jsAssetUrl
            }
            const url = resolveUrl(specifier, target.url)
            // ignore url outside project directory
            // a better version would console.warn about file url outside projectDirectoryUrl
            // and ignore them and console.info/debug about remote url (https, http, ...)
            const projectUrl = urlToProjectUrl(url)
            if (!projectUrl) {
              return { external: true, url }
            }
            return url
          },
          emitAsset: ({ source, fileName }) => {
            emitFile({
              type: "asset",
              source,
              fileName,
            })
          },
          connectTarget: (target) => {
            if (target.isExternal) {
              return null
            }

            if (target.isAsset) {
              target.connect(async () => {
                await target.getReadyPromise()
                const { sourceAfterTransformation, fileNameForRollup } = target

                if (target.isInline) {
                  return {}
                }

                logger.debug(`emit asset for ${shortenUrl(target.url)}`)
                const rollupReferenceId = emitFile({
                  type: "asset",
                  source: sourceAfterTransformation,
                  fileName: fileNameForRollup,
                })
                logger.debug(`${shortenUrl(target.url)} ready -> ${fileNameForRollup}`)
                return { rollupReferenceId }
              })
            } else {
              target.connect(async () => {
                const id = target.url
                if (typeof target.content !== "undefined") {
                  virtualModules[id] = String(target.content.value)
                }

                logger.debug(`emit chunk for ${shortenUrl(target.url)}`)
                atleastOneChunkEmitted = true
                const rollupReferenceId = emitFile({
                  type: "chunk",
                  id,
                  ...(target.previousJsReference
                    ? {
                        implicitlyLoadedAfterOneOf: [target.previousJsReference.url],
                      }
                    : {}),
                })

                return { rollupReferenceId }
              })
            }

            return null
          },
        },
      )

      await Promise.all(
        entryPointsPrepared.map(async ({ type, url, chunkName, source }) => {
          if (type === "html") {
            await compositeAssetHandler.prepareHtmlEntry(url, {
              // don't hash the html entry point
              fileNamePattern: chunkName,
              source,
            })
          } else if (type === "js") {
            atleastOneChunkEmitted = true
            emitFile({
              type: "chunk",
              id: url,
              name: chunkName,
            })
          }
        }),
      )
      if (!atleastOneChunkEmitted) {
        emitFile({
          type: "chunk",
          id: EMPTY_CHUNK_URL,
          fileName: "__empty__",
        })
      }
    },

    resolveId(specifier, importer) {
      if (importer === undefined) {
        if (specifier.endsWith(".html")) {
          importer = compileServerOrigin
        } else {
          importer = compileDirectoryRemoteUrl
        }
      }

      if (nativeModulePredicate(specifier)) {
        logger.debug(`${specifier} is native module -> marked as external`)
        return false
      }

      if (externalImportSpecifiers.includes(specifier)) {
        logger.debug(`${specifier} verifies externalImportSpecifiers -> marked as external`)
        return { id: specifier, external: true }
      }

      if (virtualModules.hasOwnProperty(specifier)) {
        return specifier
      }

      if (isFileSystemPath(importer)) {
        importer = fileSystemPathToUrl(importer)
      }
      const importUrl = resolveImport({
        specifier,
        importer,
        importMap,
        defaultExtension: importDefaultExtension,
      })

      if (importer !== projectDirectoryUrl) {
        urlImporterMapping[importUrl] = importer
      }

      // keep external url intact
      const importProjectUrl = urlToProjectUrl(importUrl)
      if (!importProjectUrl) {
        return { id: specifier, external: true }
      }

      // const rollupId = urlToRollupId(importUrl, { projectDirectoryUrl, compileServerOrigin })
      logger.debug(`${specifier} imported by ${importer} resolved to ${importUrl}`)
      return importUrl
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {

    // },

    async load(url) {
      if (url === EMPTY_CHUNK_URL) {
        return ""
      }

      const moduleInfo = this.getModuleInfo(url)

      logger.debug(`loads ${url}`)
      const { responseUrl, contentRaw, content = "", map } = await loadModule(url, moduleInfo)

      urlResponseBodyMap[url] = contentRaw

      saveModuleContent(responseUrl, {
        content,
        contentRaw,
      })
      // handle redirection
      if (responseUrl !== url) {
        saveModuleContent(url, {
          content,
          contentRaw,
        })
        redirectionMap[url] = responseUrl
      }

      return { code: content, map }
    },

    // resolveImportMeta: () => {}

    // transform should not be required anymore as
    // we will receive
    // transform: async (moduleContent, rollupId) => {}

    outputOptions: (options) => {
      // rollup does not expects to have http dependency in the mix

      options.sourcemapPathTransform = (relativePath, sourcemapPath) => {
        const sourcemapUrl = fileSystemPathToUrl(sourcemapPath)
        const url = relativePathToUrl(relativePath, sourcemapUrl)
        const projectUrl = urlToProjectUrl(url)

        if (projectUrl) {
          relativePath = urlToRelativeUrl(projectUrl, sourcemapUrl)
          return relativePath
        }
        if (url.startsWith(projectDirectoryUrl)) {
          return relativePath
        }

        return url
      }

      const relativePathToUrl = (relativePath, sourcemapUrl) => {
        const rollupUrl = resolveUrl(relativePath, sourcemapUrl)
        let url

        // fix rollup not supporting source being http
        const httpIndex = rollupUrl.indexOf(`http:/`)
        if (httpIndex > -1) {
          url = `http://${rollupUrl.slice(httpIndex + `http:/`.length)}`
        } else {
          const httpsIndex = rollupUrl.indexOf("https:/")
          if (httpsIndex > -1) {
            url = `https://${rollupUrl.slice(httpsIndex + `https:/`.length)}`
          } else {
            url = rollupUrl
          }
        }

        if (url in redirectionMap) {
          return redirectionMap[url]
        }
        return url
      }

      return options
    },

    renderChunk: async (code, chunk) => {
      if (!minify) {
        return null
      }

      const result = await minifyJs(code, chunk.fileName, {
        sourceMap: {
          ...(chunk.map ? { content: JSON.stringify(chunk.map) } : {}),
          asObject: true,
        },
        ...(format === "global" ? { toplevel: false } : { toplevel: true }),
        ...minifyJsOptions,
      })
      return {
        code: result.code,
        map: result.map,
      }
    },

    async generateBundle(outputOptions, bundle) {
      const emptyChunkKey = Object.keys(bundle).find(
        (key) => bundle[key].facadeModuleId === EMPTY_CHUNK_URL,
      )
      if (emptyChunkKey) {
        delete bundle[emptyChunkKey]
      }

      // it's important to do this to emit late asset
      emitFile = (...args) => this.emitFile(...args)
      // malheureusement rollup ne permet pas de savoir lorsqu'un chunk
      // a fini d'etre résolu (parsing des imports statiques et dynamiques recursivement)
      // donc lorsque le build se termine on va indiquer
      // aux assets faisant référence a ces chunk js qu'ils sont terminés
      // et donc les assets peuvent connaitre le nom du chunk
      // et mettre a jour leur dépendance vers ce fichier js
      await compositeAssetHandler.resolveJsReferencesUsingRollupBundle(bundle)
      logger.info(formatBundleGeneratedLog(bundle))

      if (manifestFile) {
        await writeManifestFile(bundle, bundleDirectoryUrl)
      }
    },

    async writeBundle(options, bundle) {
      if (detectAndTransformIfNeededAsyncInsertedByRollup) {
        // ptet transformer ceci en renderChunk
        await transformAsyncInsertedByRollup({
          projectDirectoryUrl,
          bundleDirectoryUrl,
          babelPluginMap,
          bundle,
        })
      }

      // Object.keys(bundle).forEach((bundleFilename) => {
      //   logger.debug(`-> ${bundleDirectoryUrl}${bundleFilename}`)
      // })
    },
  }

  // take any url string and try to return a file url (an url inside projectDirectoryUrl)
  const urlToProjectUrl = (url) => {
    if (url.startsWith(projectDirectoryUrl)) {
      return url
    }

    if (url.startsWith(`${compileServerOrigin}/`)) {
      return `${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`
    }

    return null
  }

  const urlToProjectRelativeUrl = (url) => {
    const projectUrl = urlToProjectUrl(url)
    if (!projectUrl) {
      return null
    }
    return urlToRelativeUrl(projectUrl, projectDirectoryUrl)
  }

  // take any url string and try to return the corresponding remote url (an url inside compileServerOrigin)
  const urlToServerUrl = (url) => {
    if (url.startsWith(`${compileServerOrigin}/`)) {
      return url
    }

    if (url.startsWith(projectDirectoryUrl)) {
      return `${compileServerOrigin}/${url.slice(projectDirectoryUrl.length)}`
    }

    return null
  }

  // take any url string and try to return a file url inside project directory url
  // prefer the source url if the url is inside compile directory
  const urlToOriginalProjectUrl = (url) => {
    const projectUrl = urlToProjectUrl(url)
    if (!projectUrl) {
      return null
    }

    if (!urlIsInsideOf(projectUrl, compileDirectoryUrl)) {
      return projectUrl
    }

    const relativeUrl = urlToRelativeUrl(projectUrl, compileDirectoryUrl)
    return resolveUrl(relativeUrl, projectDirectoryUrl)
  }

  const urlToCompiledUrl = (url) => {
    if (urlIsInsideOf(url, compileDirectoryUrl)) {
      return url
    }

    const projectRelativeUrl = urlToProjectRelativeUrl(url)
    if (projectRelativeUrl) {
      return resolveUrl(projectRelativeUrl, compileDirectoryRemoteUrl)
    }

    return null
  }

  const saveModuleContent = (moduleUrl, value) => {
    const remoteUrl = urlToServerUrl(moduleUrl)
    const url = urlToProjectUrl(remoteUrl || moduleUrl) || moduleUrl
    moduleContentMap[url] = value
  }

  const loadModule = async (moduleUrl, moduleInfo) => {
    if (moduleUrl in virtualModules) {
      const codeInput = virtualModules[moduleUrl]

      const { code, map } = await transformJs({
        projectDirectoryUrl,
        code: codeInput,
        url: urlToProjectUrl(moduleUrl), // transformJs expect a file:// url
        babelPluginMap,
        transformModuleIntoSystemFormat: false,
      })

      return {
        responseUrl: moduleUrl,
        contentRaw: code,
        content: code,
        map,
      }
    }

    const importerUrl = urlImporterMapping[moduleUrl]
    const moduleResponse = await fetchModule(moduleUrl, importerUrl)
    const contentType = moduleResponse.headers["content-type"] || ""
    const commonData = {
      responseUrl: moduleResponse.url,
    }

    // keep this in sync with module-registration.js
    if (contentType === "application/javascript" || contentType === "text/javascript") {
      const responseBodyAsString = await moduleResponse.text()
      const js = responseBodyAsString
      return {
        ...commonData,
        contentRaw: js,
        content: js,
        map: await fetchSourcemap(moduleUrl, js, {
          cancellationToken,
          logger,
        }),
      }
    }

    if (contentType === "application/json" || contentType === "application/importmap+json") {
      const responseBodyAsString = await moduleResponse.text()
      // there is no need to minify the json string
      // because it becomes valid javascript
      // that will be minified by minifyJs inside renderChunk
      const json = responseBodyAsString
      return {
        ...commonData,
        contentRaw: json,
        content: `export default ${json}`,
      }
    }

    const target = await compositeAssetHandler.getTargetFromResponse(moduleResponse, {
      moduleInfo,
      importerUrl,
    })

    const content = target.isInline
      ? `export default ${getTargetAsBase64Url(target)}`
      : `export default import.meta.ROLLUP_FILE_URL_${target.rollupReferenceId}`

    return {
      ...commonData,
      contentRaw: String(target.content.value),
      content,
    }
  }

  const fetchModule = async (moduleUrl, importerUrl) => {
    const response = await fetchUrl(moduleUrl, {
      cancellationToken,
      ignoreHttpsError: true,
    })
    const okValidation = validateResponseStatusIsOk(
      response,
      urlToProjectUrl(importerUrl) || importerUrl,
    )

    if (!okValidation.valid) {
      throw new Error(okValidation.message)
    }

    return response
  }

  const shortenUrl = (url) => {
    return urlIsInsideOf(url, projectDirectoryUrl)
      ? urlToRelativeUrl(url, projectDirectoryUrl)
      : url
  }

  return {
    jsenvRollupPlugin,
    getExtraInfo: () => {
      return {
        moduleContentMap,
      }
    },
  }
}

const formatIgnoreImportMap = (importmapHtmlNode, htmlUrl, htmlSource) => {
  const { line, column } = getHtmlNodeLocation(importmapHtmlNode)
  return `ignore importmap found in html file.
${htmlUrl}:${line}:${column}

${showSourceLocation(htmlSource, {
  line,
  column,
})}`
}

const formatUseImportMap = (importmapHtmlNode, htmlUrl, htmlSource) => {
  const { line, column } = getHtmlNodeLocation(importmapHtmlNode)
  return `use importmap found in html file.
${htmlUrl}:${line}:${column}

${showSourceLocation(htmlSource, {
  line,
  column,
})}`
}

const fetchAndNormalizeImportmap = async (importmapUrl) => {
  const importmapResponse = await fetchUrl(importmapUrl)
  const importmap = await importmapResponse.json()
  const importmapNormalized = normalizeImportMap(importmap, importmapUrl)
  return importmapNormalized
}

const transformAsyncInsertedByRollup = async ({
  projectDirectoryUrl,
  bundleDirectoryUrl,
  babelPluginMap,
  bundle,
}) => {
  const asyncPluginName = findAsyncPluginNameInBabelPluginMap(babelPluginMap)

  if (!asyncPluginName) return

  // we have to do this because rollup ads
  // an async wrapper function without transpiling it
  // if your bundle contains a dynamic import
  await Promise.all(
    Object.keys(bundle).map(async (bundleFilename) => {
      const bundleInfo = bundle[bundleFilename]
      const bundleFileUrl = resolveUrl(bundleFilename, bundleDirectoryUrl)

      const { code, map } = await transformJs({
        projectDirectoryUrl,
        code: bundleInfo.code,
        url: bundleFileUrl,
        map: bundleInfo.map,
        babelPluginMap: { [asyncPluginName]: babelPluginMap[asyncPluginName] },
        transformModuleIntoSystemFormat: false, // already done by rollup
        transformGenerator: false, // already done
        transformGlobalThis: false,
      })

      await Promise.all([
        writeFile(bundleFileUrl, setJavaScriptSourceMappingUrl(code, `./${bundleFilename}.map`)),
        writeFile(`${bundleFileUrl}.map`, JSON.stringify(map)),
      ])
    }),
  )
}

const formatBundleGeneratedLog = (bundle) => {
  const assetFilenames = Object.keys(bundle)
    .filter((key) => bundle[key].type === "asset")
    .map((key) => bundle[key].fileName)
  const assetCount = assetFilenames.length

  const chunkFilenames = Object.keys(bundle)
    .filter((key) => bundle[key].type === "chunk")
    .map((key) => bundle[key].fileName)
  const chunkCount = chunkFilenames.length

  const assetDescription =
    // eslint-disable-next-line no-nested-ternary
    assetCount === 0 ? "" : assetCount === 1 ? "1 asset" : `${assetCount} assets`
  const chunkDescription =
    // eslint-disable-next-line no-nested-ternary
    chunkCount === 0 ? "" : chunkCount === 1 ? "1 chunk" : `${chunkCount} chunks`

  return createDetailedMessage(`bundle generated`, {
    ...(assetDescription ? { [assetDescription]: assetFilenames } : {}),
    ...(chunkDescription ? { [chunkDescription]: chunkFilenames } : {}),
  })
}

const writeManifestFile = async (bundle, bundleDirectoryUrl) => {
  const mappings = {}
  Object.keys(bundle).forEach((key) => {
    const chunk = bundle[key]
    let chunkId = chunk.name
    chunkId += ".js"
    mappings[chunkId] = chunk.fileName
  })
  const mappingKeysSorted = Object.keys(mappings).sort(comparePathnames)
  const manifest = {}
  mappingKeysSorted.forEach((key) => {
    manifest[key] = mappings[key]
  })

  const manifestFileUrl = resolveUrl("manifest.json", bundleDirectoryUrl)
  await writeFile(manifestFileUrl, JSON.stringify(manifest, null, "  "))
}

const createDetailedMessage = (message, details = {}) => {
  let string = `${message}`

  Object.keys(details).forEach((key) => {
    const value = details[key]
    string += `
--- ${key} ---
${
  Array.isArray(value)
    ? value.join(`
`)
    : value
}`
  })

  return string
}
