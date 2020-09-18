/* eslint-disable import/max-dependencies */
import { basename } from "path"
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
  polyfillScripts,
  manipulateScripts,
  stringifyHtmlDocument,
} from "../../compiling/compileHtml.js"
import { findAsyncPluginNameInBabelPluginMap } from "../../compiling/js-compilation-service/findAsyncPluginNameInBabelPluginMap.js"

import { isBareSpecifierForNativeNodeModule } from "./isBareSpecifierForNativeNodeModule.js"
import { fetchSourcemap } from "./fetchSourcemap.js"
import { minifyHtml } from "./minifyHtml.js"
import { minifyJs } from "./minifyJs.js"
import { minifyCss } from "./minifyCss.js"

/**

A word about bundler choosing to return an absolute url for import like

import styleFileUrl from "./style.css"
import iconFileUrl from "./icon.png"

Bundler choose to return an url so that you can still access your bundled files.
In a structure like this one I would rather choose to keep target asset with "/directory/icon.png"

dist/
  esmodule/
    index.js
directory/
  icon.png

Considering it's possible to target original file from bundled files (using import starting with '/'),
Jsenv bundle do not emit any asset file.

Using import to import something else than a JavaScript file convert it to
a JavaScript module with an export default of that file content as text.
Non textual files (png, jpg, video) are converted to base64 text.

*/

const STATIC_COMPILE_SERVER_AUTHORITY = "//jsenv.com"

export const createJsenvRollupPlugin = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  entryPointMap,
  bundleDirectoryUrl,
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
  const chunkId = `${Object.keys(entryPointMap)[0]}.js`
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

  // on pourrait aussi passer a ce plugin les points d'entrée dérivé du html
  // et les mettre dans input: {} de rollup
  // le seul souci ce serais pour obtenir la référence de ces chunk par la suite

  const jsenvRollupPlugin = {
    name: "jsenv",

    async buildStart() {
      // https://github.com/easesu/rollup-plugin-html-input/blob/master/index.js
      // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
      await Promise.all(
        Object.keys(entryPointMap).map(async (key) => {
          const value = entryPointMap[key]
          if (!value.endsWith(".html")) return

          const htmlFileUrl = resolveUrl(value, projectDirectoryUrl)
          const htmlCompiledFileUrl = resolveUrl(value, compileDirectoryRemoteUrl)
          const htmlFileContent = await readFile(htmlFileUrl)
          const htmlFileName = basename(value)
          const htmlDocument = parseHtmlString(htmlFileContent)
          const { scripts } = parseHtmlDocumentRessources(htmlDocument)

          let previousScriptId
          const scriptReferences = []
          scripts.forEach((script, index) => {
            if (script.attributes.type === "module" && script.attributes.src) {
              const remoteScriptId = resolveUrl(script.attributes.src, htmlCompiledFileUrl)
              logger.debug(`${remoteScriptId} remote script found in ${value} -> emit chunk`)
              const remoteScriptReference = this.emitFile({
                type: "chunk",
                id: remoteScriptId,
                implicitlyLoadedAfterOneOf: previousScriptId ? [previousScriptId] : [],
              })
              previousScriptId = remoteScriptId
              scriptReferences.push(remoteScriptReference)
              return
            }
            if (script.attributes.type === "module" && script.text) {
              const inlineScriptId = `\0${value}-${index}`
              logger.debug(`${inlineScriptId} inline script found in ${value} -> emit chunk`)
              const inlineScriptReference = this.emitFile({
                type: "chunk",
                id: inlineScriptId,
                implicitlyLoadedAfterOneOf: previousScriptId ? [previousScriptId] : [],
              })
              previousScriptId = inlineScriptId
              scriptReferences.push(inlineScriptReference)
              return
            }
            scriptReferences.push(null)
          })

          virtualAssets.push(() => {
            polyfillScripts(scripts, {
              importmapType: "systemjs-importmap",
              generateInlineScriptSrc: (_, index) => this.getFileName(scriptReferences[index]),
              generateInlineScriptCode: ({ src }) =>
                `<script>window.System.import(${JSON.stringify(src)})</script>`,
            })
            manipulateScripts(htmlDocument, [
              {
                src: `/node_modules/systemjs/dist/s.min.js`,
              },
            ])
            const htmlTransformedString = stringifyHtmlDocument(htmlDocument)
            logger.debug(`emit html asset for ${value}`)
            this.emitFile({
              type: "asset",
              fileName: htmlFileName,
              source: htmlTransformedString,
            })
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
      const {
        responseUrl,
        contentRaw,
        content = "",
        map,
        assets = [],
        chunks = [],
      } = await loadModule(realUrl, moduleInfo)

      assets.forEach((asset) => {
        logger.debug(`${moduleInfo.id} emits asset`, asset)
        this.emitFile({
          type: "asset",
          ...asset,
        })
      })
      chunks.forEach((chunk, index) => {
        const previousChunkId = index === 0 ? null : chunks[index - 1]
        logger.debug(`${moduleInfo.id} emits chunk`, chunk)
        this.emitFile({
          type: "chunk",
          implicitlyLoadedAfterOneOf: previousChunkId ? [previousChunkId] : [],
          ...chunk,
        })
      })

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

    generateBundle: async (outputOptions, bundle) => {
      virtualAssets.forEach((fn) => {
        fn()
      })

      if (manifestFile) {
        const mappings = {}
        Object.keys(bundle).forEach((key) => {
          const chunk = bundle[key]
          mappings[`${chunk.name}.js`] = chunk.fileName
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

  const loadModule = async (moduleUrl, moduleInfo) => {
    if (moduleUrl in virtualModules) {
      const codeInput = virtualModules[moduleUrl]
      debugger

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
      return {
        ...commonData,
        ...jsonToLoadInfo(moduleText, moduleInfo),
      }
    }

    if (contentType === "text/html") {
      return {
        ...commonData,
        ...htmlToLoadInfo(moduleText, moduleInfo),
      }
    }

    if (contentType === "text/css") {
      return {
        ...commonData,
        ...cssToLoadInfo(moduleText, moduleInfo),
      }
    }

    if (contentType === "image/svg+xml") {
      return {
        ...commonData,
        ...svgToLoadInfo(moduleText, moduleInfo),
      }
    }

    if (contentType.startsWith("text/")) {
      return {
        ...commonData,
        ...textToLoadInfo(moduleText, moduleInfo),
      }
    }

    logger.debug(`Using buffer to bundle module because of its content-type.
--- content-type ---
${contentType}
--- module url ---
${moduleUrl}`)

    return {
      ...commonData,
      ...bufferToLoadInfo(Buffer.from(moduleText), moduleInfo),
    }
  }

  const jsonToLoadInfo = (jsonString) => {
    // there is no need to minify the json string
    // because it becomes valid javascript
    // that will be minified by minifyJs inside renderChunk
    return { content: `export default ${jsonString}` }
  }

  const htmlToLoadInfo = (htmlString, { isEntry, id }) => {
    if (isEntry) {
      return {
        content: "",
      }
    }

    if (minify) {
      htmlString = minifyHtml(htmlString, minifyHtmlOptions)
    }

    return {
      content: "",
      assets: [
        {
          name: basename(id),
          source: htmlString,
        },
      ],
    }
  }

  const cssToLoadInfo = (cssString, { id }) => {
    if (minify) {
      cssString = minifyCss(cssString, minifyCssOptions)
    }
    return {
      assets: [
        {
          name: basename(id),
          source: cssString,
        },
      ],
    }
  }

  const svgToLoadInfo = (svgString, { id }) => {
    // could also benefit of minification https://github.com/svg/svgo
    return {
      assets: [
        {
          name: basename(id),
          source: svgString,
        },
      ],
    }
  }

  const textToLoadInfo = (textString, { id }) => {
    return {
      assets: [
        {
          name: basename(id),
          source: textString,
        },
      ],
    }
  }

  const bufferToLoadInfo = (buffer, { id }) => {
    return {
      assets: [
        {
          name: basename(id),
          source: buffer,
        },
      ],
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
