/* eslint-disable import/max-dependencies */
import { basename, extname } from "path"
import { normalizeImportMap, resolveImport } from "@jsenv/import-map"
import {
  isFileSystemPath,
  fileSystemPathToUrl,
  resolveUrl,
  urlToRelativeUrl,
  resolveDirectoryUrl,
  writeFile,
  readFile,
  comparePathnames,
} from "@jsenv/util"

import { appendSourceMappingAsExternalUrl } from "../../sourceMappingURLUtils.js"
import { fetchUrl } from "../../fetchUrl.js"
import { validateResponseStatusIsOk } from "../../validateResponseStatusIsOk.js"
import { transformJs } from "../../compiling/js-compilation-service/transformJs.js"
import {
  parseHtmlString,
  parseHtmlDocumentRessources,
  manipulateHtmlDocument,
  transformHtmlDocumentImportmapScript,
  transformHtmlDocumentModuleScripts,
  stringifyHtmlDocument,
} from "../../compiling/compileHtml.js"
import { findAsyncPluginNameInBabelPluginMap } from "../../compiling/js-compilation-service/findAsyncPluginNameInBabelPluginMap.js"

import { isBareSpecifierForNativeNodeModule } from "./isBareSpecifierForNativeNodeModule.js"
import { fetchSourcemap } from "./fetchSourcemap.js"
import { minifyHtml } from "./minifyHtml.js"
import { minifyJs } from "./minifyJs.js"
import { minifyCss } from "./minifyCss.js"

const STATIC_COMPILE_SERVER_AUTHORITY = "//jsenv.com"

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
  compileServerImportMap,
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
  systemJsScript = { src: "/node_modules/systemjs/dist/s.min.js" },

  detectAndTransformIfNeededAsyncInsertedByRollup = format === "global",
}) => {
  const moduleContentMap = {}
  const redirectionMap = {}

  // use a fake and predictable compile server origin
  // because rollup will check the dependencies url
  // when computing the file hash
  // see https://github.com/rollup/rollup/blob/d6131378f9481a442aeaa6d4e608faf3303366dc/src/Chunk.ts#L795
  // this way file hash remains the same when file content does not change
  const compileServerOriginForRollup = String(
    new URL(STATIC_COMPILE_SERVER_AUTHORITY, compileServerOrigin),
  ).slice(0, -1)
  const compileDirectoryRemoteUrl = resolveDirectoryUrl(
    compileDirectoryRelativeUrl,
    compileServerOriginForRollup,
  )
  let chunkId = Object.keys(entryPointMap)[0]
  if (!extname(chunkId)) chunkId += bundleDefaultExtension
  const importMap = normalizeImportMap(compileServerImportMap, compileDirectoryRemoteUrl)

  const nativeModulePredicate = (specifier) => {
    if (node && isBareSpecifierForNativeNodeModule(specifier)) return true
    // for now browser have no native module
    // and we don't know how we will handle that
    if (browser) return false
    return false
  }

  const virtualModules = {}
  const virtualAssets = []

  const jsenvRollupPlugin = {
    name: "jsenv",

    async buildStart() {
      // https://github.com/easesu/rollup-plugin-html-input/blob/master/index.js
      // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
      await Promise.all(
        Object.keys(entryPointMap).map(async (key) => {
          const chunkFileRelativeUrl = entryPointMap[key]
          const chunkFileUrl = resolveUrl(chunkFileRelativeUrl, projectDirectoryUrl)
          // const chunkBundledFileUrl = resolveUrl(chunkFileRelativeUrl, bundleDirectoryUrl)

          if (!chunkFileRelativeUrl.endsWith(".html")) {
            this.emitFile({
              type: "chunk",
              id: chunkFileRelativeUrl,
              fileName: `${key}${bundleDefaultExtension || extname(chunkFileRelativeUrl)}`,
            })
            return
          }

          // const htmlFileRemoteUrl = resolveUrl(value, compileServerOrigin)
          // const htmlCompiledFileRemoteUrl = resolveUrl(value, compileDirectoryRemoteUrl)
          const htmlFileContent = await readFile(chunkFileUrl)
          const htmlFileName = basename(chunkFileRelativeUrl)
          const htmlDocument = parseHtmlString(htmlFileContent)
          const { scripts } = parseHtmlDocumentRessources(htmlDocument)

          let previousScriptId
          const scriptReferences = []
          scripts.forEach((script, index) => {
            if (script.attributes.type === "module" && script.attributes.src) {
              logger.debug(
                `remote script ${script.attributes.src} found in ${chunkFileRelativeUrl} -> emit chunk`,
              )
              const remoteScriptId = script.attributes.src
              const remoteScriptUrl = resolveUrl(script.attributes.src, chunkFileUrl)
              const remoteScriptRelativeUrl = urlToRelativeUrl(remoteScriptUrl, projectDirectoryUrl)
              const remoteScriptReference = this.emitFile({
                type: "chunk",
                id: `./${remoteScriptRelativeUrl}`,
                ...(previousScriptId ? { implicitlyLoadedAfterOneOf: [previousScriptId] } : {}),
              })
              previousScriptId = remoteScriptId
              scriptReferences.push(remoteScriptReference)
              return
            }
            if (script.attributes.type === "module" && script.text) {
              const inlineScriptId = resolveUrl(`htmlFileName.${index}.js`, chunkFileUrl)
              logger.debug(
                `inline script number ${index} found in ${chunkFileRelativeUrl} -> emit chunk`,
              )
              virtualModules[inlineScriptId] = script.text
              const inlineScriptReference = this.emitFile({
                type: "chunk",
                id: inlineScriptId,
                ...(previousScriptId ? { implicitlyLoadedAfterOneOf: [previousScriptId] } : {}),
              })
              previousScriptId = inlineScriptId
              scriptReferences.push(inlineScriptReference)

              return
            }
            scriptReferences.push(null)
          })

          virtualAssets.push(async (rollup) => {
            const htmlFileUrl = resolveUrl(
              key.endsWith(".html") ? key : `${key}.html`,
              projectDirectoryUrl,
            )

            manipulateHtmlDocument(htmlDocument, {
              scriptManipulations: systemJsScript ? [systemJsScript] : [],
            })
            const importMapFileUrl = resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl)
            const importMapFileRelativeUrlForHtml = urlToRelativeUrl(importMapFileUrl, htmlFileUrl)
            transformHtmlDocumentImportmapScript(scripts, {
              type: "systemjs-importmap",
              // ensure the html src is the one passed when generating the bundle
              // this is useful in case you have an importmap while developping
              // but want to use a different one to bundle so that
              // the production importmap is smaller
              // but override only if a custom importmap is passed
              ...(importMapFileRelativeUrl ? { src: importMapFileRelativeUrlForHtml } : {}),
            })

            transformHtmlDocumentModuleScripts(scripts, {
              generateInlineScriptCode: (_, index) => {
                const scriptRelativeUrl = rollup.getFileName(scriptReferences[index])
                const scriptUrl = resolveUrl(scriptRelativeUrl, bundleDirectoryUrl)
                const scriptUrlRelativeToHtmlFile = urlToRelativeUrl(scriptUrl, htmlFileUrl)
                return `<script>window.System.import(${JSON.stringify(
                  `./${scriptUrlRelativeToHtmlFile}`,
                )})</script>`
              },
            })
            const htmlTransformedString = stringifyHtmlDocument(htmlDocument)
            logger.debug(`write ${htmlFileName} at ${htmlFileUrl}`)
            await writeFile(
              htmlFileUrl,
              minify ? minifyHtml(htmlTransformedString, minifyHtmlOptions) : htmlTransformedString,
            )
          })
        }),
      )
    },

    resolveId(specifier, importer) {
      if (importer === undefined) {
        if (specifier.endsWith(".html")) {
          importer = compileServerOriginForRollup
        } else {
          importer = compileDirectoryRemoteUrl
        }
      }

      if (nativeModulePredicate(specifier)) {
        logger.debug(`${specifier} is native module -> marked as external`)
        return false
      }

      if (externalImportSpecifiers.includes(specifier)) {
        logger.debug(`${specifier} verifies externalImportSpecifiers  -> marked as external`)
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
      // const rollupId = urlToRollupId(importUrl, { projectDirectoryUrl, compileServerOrigin })
      logger.debug(`${specifier} imported by ${importer} resolved to ${importUrl}`)
      return importUrl
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {

    // },

    async load(urlForRollup) {
      const moduleInfo = this.getModuleInfo(urlForRollup)
      const realUrl = urlToRealUrl(urlForRollup) || urlForRollup

      logger.debug(`loads ${realUrl}`)
      const { responseUrl, contentRaw, content = "", map } = await loadModule(
        realUrl,
        moduleInfo,
        this.emitFile.bind(this),
      )

      const responseUrlForRollup = urlToUrlForRollup(responseUrl) || responseUrl
      saveModuleContent(responseUrlForRollup, {
        content,
        contentRaw,
      })
      // handle redirection
      if (responseUrlForRollup !== urlForRollup) {
        saveModuleContent(urlForRollup, {
          content,
          contentRaw,
        })
        redirectionMap[urlForRollup] = responseUrlForRollup
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
        const url = relativePathToUrlForRollup(relativePath)

        if (url.startsWith(`${compileServerOriginForRollup}/`)) {
          const relativeUrl = url.slice(`${compileServerOriginForRollup}/`.length)
          const fileUrl = `${projectDirectoryUrl}${relativeUrl}`
          relativePath = urlToRelativeUrl(fileUrl, bundleSourcemapFileUrl)
          return relativePath
        }
        if (url.startsWith(projectDirectoryUrl)) {
          return relativePath
        }

        return url
      }

      const relativePathToUrlForRollup = (relativePath) => {
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
      virtualAssets.forEach((fn) => {
        fn(this)
      })

      if (manifestFile) {
        const mappings = {}
        Object.keys(bundle).forEach((key) => {
          const chunk = bundle[key]
          let chunkId = chunk.name
          chunkId += '.js'
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

    writeBundle: async (options, bundle) => {
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

  const urlToRealUrl = (url) => {
    if (url.startsWith(`${compileServerOriginForRollup}/`)) {
      return `${compileServerOrigin}/${url.slice(`${compileServerOriginForRollup}/`.length)}`
    }
    return null
  }

  const urlToUrlForRollup = (url) => {
    if (url.startsWith(`${compileServerOrigin}/`)) {
      return `${compileServerOriginForRollup}/${url.slice(`${compileServerOrigin}/`.length)}`
    }
    return null
  }

  const saveModuleContent = (moduleUrl, value) => {
    const realUrl = urlToRealUrl(moduleUrl) || moduleUrl
    const url = urlToProjectUrl(realUrl) || moduleUrl
    moduleContentMap[url] = value
  }

  const urlToProjectUrl = (url) => {
    if (url.startsWith(`${compileServerOrigin}/`)) {
      return `${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`
    }
    return null
  }

  const loadModule = async (moduleUrl, moduleInfo, emitFile) => {
    if (moduleUrl in virtualModules) {
      const codeInput = virtualModules[moduleUrl]

      const { code, map } = await transformJs({
        projectDirectoryUrl,
        code: codeInput,
        url: moduleUrl,
        babelPluginMap,
      })

      return {
        responseUrl: moduleUrl,
        contentRaw: code,
        content: code,
        map,
      }
    }

    const moduleResponse = await fetchModule(moduleUrl)
    const contentType = moduleResponse.headers["content-type"] || ""
    const moduleText = await moduleResponse.text()

    const commonData = {
      responseUrl: moduleResponse.url,
      contentRaw: moduleText,
    }

    // keep this in sync with module-registration.js
    if (contentType === "application/javascript" || contentType === "text/javascript") {
      return {
        ...commonData,
        content: moduleText,
        map: await fetchSourcemap({
          cancellationToken,
          logger,
          moduleUrl,
          moduleContent: moduleText,
        }),
      }
    }

    if (contentType === "application/json" || contentType === "application/importmap+json") {
      // there is no need to minify the json string
      // because it becomes valid javascript
      // that will be minified by minifyJs inside renderChunk
      const jsonString = moduleText
      return {
        ...commonData,
        content: `export default ${jsonString}`,
      }
    }

    if (contentType === "text/html") {
      if (moduleInfo.isEntry) {
        return {
          content: "",
        }
      }

      const htmlString = minify ? minifyHtml(htmlString, minifyHtmlOptions) : moduleText
      const referenceId = emitFile({
        type: "asset",
        name: basename(moduleInfo.id),
        source: htmlString,
      })
      return {
        ...commonData,
        content: `export default import.meta.ROLLUP_FILE_URL_${referenceId};`,
      }
    }

    if (contentType === "text/css") {
      const cssString = minify ? minifyCss(moduleText, minifyCssOptions) : moduleText
      const referenceId = emitFile({
        type: "asset",
        name: basename(moduleInfo.id),
        source: cssString,
      })
      return {
        ...commonData,
        content: `export default import.meta.ROLLUP_FILE_URL_${referenceId};`,
      }
    }

    if (contentType === "image/svg+xml") {
      // could also benefit of minification https://github.com/svg/svgo
      const svgString = moduleText
      const referenceId = emitFile({
        type: "asset",
        name: basename(moduleInfo.id),
        source: svgString,
      })
      return {
        ...commonData,
        content: `export default import.meta.ROLLUP_FILE_URL_${referenceId};`,
      }
    }

    if (contentType.startsWith("text/")) {
      const textString = moduleText
      const referenceId = emitFile({
        type: "asset",
        name: basename(moduleInfo.id),
        source: textString,
      })
      return {
        ...commonData,
        content: `export default import.meta.ROLLUP_FILE_URL_${referenceId};`,
      }
    }

    logger.debug(`Using buffer to bundle module because of its content-type.
--- content-type ---
${contentType}
--- module url ---
${moduleUrl}`)
    const buffer = Buffer.from(moduleText)
    const referenceId = emitFile({
      type: "asset",
      name: basename(moduleInfo.id),
      source: buffer,
    })
    return {
      ...commonData,
      content: `export default import.meta.ROLLUP_FILE_URL_${referenceId};`,
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

  return {
    jsenvRollupPlugin,
    getExtraInfo: () => {
      return {
        moduleContentMap,
      }
    },
  }
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
        writeFile(bundleFileUrl, appendSourceMappingAsExternalUrl(code, `./${bundleFilename}.map`)),
        writeFile(`${bundleFileUrl}.map`, JSON.stringify(map)),
      ])
    }),
  )
}
