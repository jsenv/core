/**
 * a faire
 *
 * - vérifier la résolution d'url pour un asset
 * -> ne doit pas etre remap par l'importmap sauf si l'asset est référencé par du js
 * excepté https://github.com/WICG/import-maps#import-urls
 * - pouvoir décider d'inline certains assets ?
 * peut etre utile pour importmap, favicon et ptet certains css critique
 * autrement dit un asset qui est trouvé pas inline doit pouvoir etre forcé a inline
 * on fera base64 pour une image et juste le fichier brute pour css, ou importmap.
 * pour les importmap on le supporte tant que cela ne change
 * pas son url de destinatio, sinon on emit un warning
 * - css minification
 * - html minification
 * - <link rel="favicon"
 * - <img>
 * - xlink:href="" in svg
 * in theory inline style attributes
 * - <source> inside <audio>, <video>, <srcset>
 */

/* eslint-disable import/max-dependencies */
import { extname } from "path"
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
} from "../../compiling/compileHtml.js"

import { isBareSpecifierForNativeNodeModule } from "./isBareSpecifierForNativeNodeModule.js"
import { fetchSourcemap } from "./fetchSourcemap.js"
import { minifyHtml } from "./minifyHtml.js"
import { minifyJs } from "./minifyJs.js"
import { minifyCss } from "./minifyCss.js"

import { createCompositeAssetHandler } from "./compositeAsset.js"
import { parseHtmlAsset } from "./parseHtmlAsset.js"
import { parseCssAsset } from "./parseCssAsset.js"
import { parseImportmapAsset } from "./parseImportmapAsset.js"

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
  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,
  manifestFile,
  systemJsUrl,

  bundleDirectoryUrl,
  bundleDefaultExtension,
  detectAndTransformIfNeededAsyncInsertedByRollup = format === "global",
}) => {
  // simplify this to track only raw content because we care only about this
  // and deprecate for urlSourceMapping
  const moduleContentMap = {}
  // rename urlRedirectionMapping = {}
  const redirectionMap = {}

  const EMPTY_CHUNK_URL = resolveUrl("__empty__", projectDirectoryUrl)

  let chunkId = Object.keys(entryPointMap)[0]
  if (!extname(chunkId)) chunkId += bundleDefaultExtension

  const compileDirectoryUrl = resolveDirectoryUrl(compileDirectoryRelativeUrl, projectDirectoryUrl)
  const compileDirectoryRemoteUrl = resolveDirectoryUrl(
    compileDirectoryRelativeUrl,
    compileServerOrigin,
  )
  const importMapFileRemoteUrl = resolveUrl(importMapFileRelativeUrl, compileDirectoryRemoteUrl)
  const importMapFileResponse = await fetchUrl(importMapFileRemoteUrl)
  const importMapRaw = await importMapFileResponse.json()
  logger.debug(`importmap file fetched from ${importMapFileRemoteUrl}`)

  const importMap = normalizeImportMap(importMapRaw, importMapFileRemoteUrl)

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

  let compositeAssetHandler
  let emitFile = () => {}
  const jsenvRollupPlugin = {
    name: "jsenv",

    async buildStart() {
      emitFile = (...args) => this.emitFile(...args)

      let chunkEmitCount = 0
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

            return null
          },
          load: async (url) => {
            const moduleResponse = await fetchModule(url)
            // const contentType = moduleResponse.headers["content-type"] || ""
            const responseBodyAsArrayBuffer = await moduleResponse.arrayBuffer()
            return Buffer.from(responseBodyAsArrayBuffer)
          },
        },
        {
          projectDirectoryUrl: `${compileServerOrigin}`,
          bundleDirectoryUrl: resolveUrl(
            urlToRelativeUrl(bundleDirectoryUrl, projectDirectoryUrl),
            compileServerOrigin,
          ),
          urlToOriginalProjectUrl,
          loadReference: (url) => urlResponseBodyMap[url],
          resolveTargetReference: (target, specifier, { isAsset }) => {
            if (target.isEntry && target.isAsset && !isAsset) {
              // html entry point
              // when html references a js we must wait for the compiled version of js
              const htmlCompiledUrl = urlToCompiledUrl(target.url)
              const jsAssetUrl = resolveUrl(specifier, htmlCompiledUrl)
              return jsAssetUrl
            }
            return resolveUrl(specifier, target.url)
          },
          emitAsset: ({ source, fileName }) => {
            emitFile({
              type: "asset",
              source,
              fileName,
            })
          },
          connectTarget: (target) => {
            // ignore url outside project directory
            // a better version would console.warn about file url outside projectDirectoryUrl
            // and ignore them and console.info/debug about remote url (https, http, ...)
            const projectUrl = urlToProjectUrl(target.url)
            if (!projectUrl) {
              logger.warn(
                formatExternalFileWarning(target, {
                  projectDirectoryUrl,
                  compositeAssetHandler,
                }),
              )
              return { external: true }
            }

            if (target.isAsset) {
              target.connect(async () => {
                await target.getFileNameReadyPromise()
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
                if (typeof target.source !== "undefined") {
                  virtualModules[id] = target.source
                }

                logger.debug(`emit chunk for ${shortenUrl(target.url)}`)
                chunkEmitCount++
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

      // https://github.com/easesu/rollup-plugin-html-input/blob/master/index.js
      // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string

      await Promise.all(
        Object.keys(entryPointMap).map(async (key) => {
          // const chunkBundledFileUrl = resolveUrl(chunkFileRelativeUrl, bundleDirectoryUrl)
          const chunkFileRelativeUrl = entryPointMap[key]
          if (chunkFileRelativeUrl.endsWith(".html")) {
            const chunkFileServerUrl = resolveUrl(chunkFileRelativeUrl, compileServerOrigin)
            await compositeAssetHandler.prepareAssetEntry(chunkFileServerUrl, {
              // don't hash the html entry point
              fileNamePattern: key.endsWith(".html") ? key : `${key}.html`,
            })
            return
          }

          chunkEmitCount++
          emitFile({
            type: "chunk",
            id: chunkFileRelativeUrl,
            fileName: `${key}${bundleDefaultExtension || extname(chunkFileRelativeUrl)}`,
          })
        }),
      )

      // rollup will yell at us telling we did not provide an input option
      // if we provide only an html file without any script type module in it
      // but this can be desired to produce a bundle with only assets (html, css, images)
      // without any js
      // we emit an empty chunk, discards rollup warning about it and we manually remove
      // this chunk in generateBundle hook
      if (chunkEmitCount === 0) {
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

      const bundleSourcemapFileUrl = resolveUrl(`./${chunkId}.map`, bundleDirectoryUrl)

      // options.sourcemapFile = bundleSourcemapFileUrl

      options.sourcemapPathTransform = (relativePath) => {
        const url = relativePathToUrl(relativePath)
        const projectUrl = urlToProjectUrl(url)

        if (projectUrl) {
          relativePath = urlToRelativeUrl(projectUrl, bundleSourcemapFileUrl)
          return relativePath
        }
        if (url.startsWith(projectDirectoryUrl)) {
          return relativePath
        }

        return url
      }

      const relativePathToUrl = (relativePath) => {
        const rollupUrl = resolveUrl(relativePath, bundleSourcemapFileUrl)
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

    renderChunk: (code) => {
      if (!minify) return null

      // https://github.com/terser-js/terser#minify-options
      const result = minifyJs(code, {
        sourceMap: true,
        ...(format === "global" ? { toplevel: false } : { toplevel: true }),
        ...minifyJsOptions,
      })
      if (result.error) {
        throw result.error
      } else {
        return result
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

    // ptet transformer ceci en renderChunk
    async writeBundle(options, bundle) {
      if (detectAndTransformIfNeededAsyncInsertedByRollup) {
        await transformAsyncInsertedByRollup({
          projectDirectoryUrl,
          bundleDirectoryUrl,
          babelPluginMap,
          bundle,
        })
      }

      Object.keys(bundle).forEach((bundleFilename) => {
        logger.info(`-> ${bundleDirectoryUrl}${bundleFilename}`)
      })
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

    const generateJavaScriptForAssetSource = async (assetSource) => {
      return compositeAssetHandler.generateJavaScriptForAssetImport(moduleUrl, {
        source: assetSource,
        importerUrl: urlImporterMapping[moduleUrl],
        // importerSource: urlSourceMapping[urlImporterMapping[moduleUrl]],
      })
    }

    const moduleResponse = await fetchModule(moduleUrl)
    const contentType = moduleResponse.headers["content-type"] || ""
    const moduleResponseBodyAsBuffer = Buffer.from(await moduleResponse.arrayBuffer())

    const commonData = {
      responseUrl: moduleResponse.url,
      contentRaw: moduleResponseBodyAsBuffer,
    }

    // keep this in sync with module-registration.js
    if (contentType === "application/javascript" || contentType === "text/javascript") {
      const js = String(moduleResponseBodyAsBuffer)
      return {
        ...commonData,
        content: js,
        map: await fetchSourcemap({
          cancellationToken,
          logger,
          moduleUrl,
          moduleContent: js,
        }),
      }
    }

    if (contentType === "application/json" || contentType === "application/importmap+json") {
      // there is no need to minify the json string
      // because it becomes valid javascript
      // that will be minified by minifyJs inside renderChunk
      const json = String(moduleResponseBodyAsBuffer)
      return {
        ...commonData,
        content: `export default ${json}`,
      }
    }

    if (contentType === "text/html") {
      if (moduleInfo.isEntry) {
        // better emit a warning an throw an error there
        return {
          content: "",
        }
      }
      const html = String(moduleResponseBodyAsBuffer)
      const htmlTransformed = minify ? minifyHtml(html, minifyHtmlOptions) : html
      return {
        ...commonData,
        content: await generateJavaScriptForAssetSource(htmlTransformed),
      }
    }

    if (contentType === "text/css") {
      const css = String(moduleResponseBodyAsBuffer)
      const cssTransformed = minify ? minifyCss(css, minifyCssOptions) : css
      return {
        ...commonData,
        content: await generateJavaScriptForAssetSource(cssTransformed),
      }
    }

    if (contentType === "image/svg+xml") {
      // could also benefit of minification https://github.com/svg/svgo
      const svg = String(moduleResponseBodyAsBuffer)
      return {
        ...commonData,
        content: await generateJavaScriptForAssetSource(svg),
      }
    }

    if (contentType.startsWith("text/")) {
      const text = String(moduleResponseBodyAsBuffer)
      return {
        ...commonData,
        content: await generateJavaScriptForAssetSource(text),
      }
    }

    logger.debug(`Using buffer to bundle module because of its content-type.
--- content-type ---
${contentType}
--- module url ---
${moduleUrl}`)
    return {
      ...commonData,
      content: await generateJavaScriptForAssetSource(moduleResponseBodyAsBuffer),
    }
  }

  const fetchModule = async (moduleUrl) => {
    const response = await fetchUrl(moduleUrl, {
      cancellationToken,
      ignoreHttpsError: true,
    })
    const okValidation = validateResponseStatusIsOk(response)

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

const formatExternalFileWarning = (target, { compositeAssetHandler, projectDirectoryUrl }) => {
  return `Ignoring reference a file outside project directory.
${compositeAssetHandler.showReferenceSourceLocation(target.references[0])}
--- reference url ---
${target.url}
--- project directory url ---
${projectDirectoryUrl}`
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
