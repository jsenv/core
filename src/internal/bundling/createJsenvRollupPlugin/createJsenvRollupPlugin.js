/**
 * a faire
 *
 * importmap in html
 * - link css in html
 * - inline css in html
 * - tester un aset remap avec importmap
 * - recevoir un systemJsScriptRelativeUrl qu'on ajoutera
 * au html lorsque le bundle est de type systemjs
 * (on le mettra inline)
 * et que si la page html contient une balise script
 * - a warning about some node in html
 * we must have the source from extractSourceLocation properly shown
 * test also a syntax error in html
 * - a warning about some node in css
 * one with @import, one with url()
 * a css syntax error to see how it goes
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

import { isBareSpecifierForNativeNodeModule } from "./isBareSpecifierForNativeNodeModule.js"
import { fetchSourcemap } from "./fetchSourcemap.js"
import { minifyHtml } from "./minifyHtml.js"
import { minifyJs } from "./minifyJs.js"
import { minifyCss } from "./minifyCss.js"
import { createCompositeAssetHandler } from "./compositeAsset.js"
import { jsenvCompositeAssetHooks } from "./jsenvCompositeAssetHooks.js"

export const createJsenvRollupPlugin = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  entryPointMap,
  bundleDirectoryUrl,
  bundleDefaultExtension,
  importMapFileRelativeUrl,
  compileDirectoryRelativeUrl,
  compileServerOrigin,
  importDefaultExtension,

  externalImportSpecifiers,
  node,
  browser,
  babelPluginMap,
  format,
  minify,
  // https://github.com/terser/terser#minify-options
  minifyJsOptions,
  // https://github.com/jakubpawlowicz/clean-css#constructor-options
  minifyCssOptions,
  // https://github.com/kangax/html-minifier#options-quick-reference
  minifyHtmlOptions,
  manifestFile,
  // systemJsFileUrl = "/node_modules/systemjs/dist/s.min.js",

  detectAndTransformIfNeededAsyncInsertedByRollup = format === "global",
}) => {
  const moduleContentMap = {}
  const redirectionMap = {}

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
  const urlSourceMapping = {}
  const virtualModules = {}

  let compositeAssetHandler
  let emitFile = () => {}
  const jsenvRollupPlugin = {
    name: "jsenv",

    async buildStart() {
      emitFile = (...args) => this.emitFile(...args)
      compositeAssetHandler = createCompositeAssetHandler(
        {
          ...jsenvCompositeAssetHooks,
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
          loadReference: (url) => urlSourceMapping[url],
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
          if (!chunkFileRelativeUrl.endsWith(".html")) {
            emitFile({
              type: "chunk",
              id: chunkFileRelativeUrl,
              fileName: `${key}${bundleDefaultExtension || extname(chunkFileRelativeUrl)}`,
            })
            return
          }

          const chunkFileServerUrl = resolveUrl(chunkFileRelativeUrl, compileServerOrigin)
          await compositeAssetHandler.prepareAssetEntry(chunkFileServerUrl, {
            fileNameForRollup: key.endsWith(".html") ? key : `${key}.html`,
          })
        }),
      )
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
      if (!urlIsInsideOf(importUrl, compileServerOrigin)) {
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
      const moduleInfo = this.getModuleInfo(url)

      logger.debug(`loads ${url}`)
      const { responseUrl, contentRaw, content = "", map } = await loadModule(url, moduleInfo)

      urlSourceMapping[url] = contentRaw

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

    renderChunk: (source) => {
      if (!minify) return null

      // https://github.com/terser-js/terser#minify-options
      const result = minifyJs(source, {
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

// const urlToRollupId = (url, { compileServerOrigin, projectDirectoryUrl }) => {
//   if (url.startsWith(`${compileServerOrigin}/`)) {
//     return urlToFileSystemPath(`${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`)
//   }
//   if (url.startsWith("file://")) {
//     return urlToFileSystemPath(url)
//   }
//   return url
// }

// const urlToServerUrl = (url, { projectDirectoryUrl, compileServerOrigin }) => {
//   if (url.startsWith(projectDirectoryUrl)) {
//     return `${compileServerOrigin}/${url.slice(projectDirectoryUrl.length)}`
//   }
//   return null
// }

// const rollupIdToFileServerUrl = (rollupId, { projectDirectoryUrl, compileServerOrigin }) => {
//   const fileUrl = rollupIdToFileUrl(rollupId)
//   if (!fileUrl) {
//     return null
//   }

//   if (!fileUrl.startsWith(projectDirectoryUrl)) {
//     return null
//   }

//   const fileRelativeUrl = urlToRelativeUrl(fileUrl, projectDirectoryUrl)
//   return `${compileServerOrigin}/${fileRelativeUrl}`
// }

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
