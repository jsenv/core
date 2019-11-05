/* eslint-disable import/max-dependencies */
import { statSync } from "fs"
import { fileWrite } from "@dmail/helper"
import { ressourceToContentType, defaultContentTypeMap } from "@dmail/server"
import { hrefToPathname } from "@jsenv/href"
import { normalizeImportMap, composeTwoImportMaps, resolveImport } from "@jsenv/import-map"
import { generateImportMapForPackage } from "@jsenv/node-module-import-map"
import { jsenvCoreDirectoryUrl } from "../../../jsenvCoreDirectoryUrl.js"
import {
  fileUrlToRelativePath,
  hasScheme,
  fileUrlToPath,
  pathToFileUrl,
  resolveFileUrl,
} from "../../../urlUtils.js"
import { writeSourceMappingURL } from "../../../sourceMappingURLUtils.js"
import { generateBabelPluginMapOption } from "../../generateBabelPluginMapOption/generateBabelPluginMapOption.js"
import { readProjectImportMap } from "../../../readProjectImportMap/readProjectImportMap.js"
// instead of importing all thoose from compile-server
// bundling could and should start a compile server and fetch source from it
// by default we would disable cache just to make things as they were
// but we could also enable it
import {
  babelHelperMap,
  babelHelperIsInsideJsenvCore,
} from "../../../compile-server/js-compilation-service/babelHelperMap.js"
import { generateBabelHelper } from "../../../compile-server/js-compilation-service/generateBabelHelper.js"
import { transformJs } from "../../../compile-server/js-compilation-service/transformJs.js"
import { findAsyncPluginNameInBabelPluginMap } from "../../../compile-server/js-compilation-service/findAsyncPluginNameInBabelPluginMap.js"

import { fetchUrl } from "./fetchUrl.js"
import { fetchSourcemap } from "./fetchSourcemap.js"
import { validateResponseStatusIsOk } from "./validateResponseStatusIsOk.js"

const { minify: minifyCode } = import.meta.require("terser")

export const createJsenvRollupPlugin = async ({
  cancellationToken,
  projectDirectoryUrl,
  bundleDirectoryUrl,
  importMapFileRelativePath,
  importMapForBundle,
  importDefaultExtension,
  importReplaceMap,
  importFallbackMap,
  // bundleCache,
  // bundleCacheDirectoryRelativePath,
  babelPluginMap,
  babelPluginRequiredNameArray,
  convertMap,
  minify,
  format,
  detectAndTransformIfNeededAsyncInsertedByRollup = format === "global",
  entryPointMap,
  logger,
}) => {
  const arrayOfUrlToSkipTransform = []
  const arrayOfAbstractUrl = []
  const moduleContentMap = {}

  const bundleConstantAbstractSpecifier = "/.jsenv/BUNDLE_CONSTANTS.js"

  babelPluginMap = generateBabelPluginMapOption({
    format,
    babelPluginMap,
    babelPluginRequiredNameArray,
  })

  importFallbackMap = {
    // importMap is optionnal
    "/importMap.json": () => `{}`,
    ...importFallbackMap,
  }
  importFallbackMap = resolveSpecifierMap(importFallbackMap, projectDirectoryUrl)

  const chunkId = `${Object.keys(entryPointMap)[0]}.js`
  importReplaceMap = {
    [bundleConstantAbstractSpecifier]: () => `export const chunkId = ${JSON.stringify(chunkId)}`,
    ...importReplaceMap,
  }
  Object.keys(babelHelperMap).forEach((babelHelperName) => {
    if (!babelHelperIsInsideJsenvCore(babelHelperName)) {
      const babelHelperPath = babelHelperMap[babelHelperName]
      importReplaceMap[babelHelperPath] = () => generateBabelHelper(babelHelperName)
    }
  })
  importReplaceMap = resolveSpecifierMap(importReplaceMap, projectDirectoryUrl)

  const importMapForProject = await readProjectImportMap({
    logger,
    projectDirectoryUrl,
    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    importMapFileRelativePath,
  })
  const importMap = normalizeImportMap(
    [
      await generateImportMapForPackage({
        projectDirectoryPath: fileUrlToPath(jsenvCoreDirectoryUrl),
        rootProjectDirectoryPath: fileUrlToPath(projectDirectoryUrl),
        logger,
      }),
      ...(importMapFileRelativePath === "./importMap.json"
        ? []
        : [
            {
              imports: {
                "/importMap.json": importMapFileRelativePath,
              },
            },
          ]),
      importMapForProject,
      importMapForBundle,
    ].reduce((previous, current) => composeTwoImportMaps(previous, current), {}),
    projectDirectoryUrl,
  )

  const jsenvRollupPlugin = {
    name: "jsenv",

    resolveId: (specifier, importer = projectDirectoryUrl) => {
      if (!hasScheme(importer)) {
        importer = pathToFileUrl(importer)
      }

      const importUrl = resolveImport({
        specifier,
        importer,
        importMap,
        defaultExtension: importDefaultExtension,
      })

      logger.debug(`resolve ${specifier} to ${importUrl}`)

      if (importUrl.startsWith("file://")) {
        // TODO: open an issue rollup side
        // to explain the issue here
        // which is that if id is not an os path
        // sourcemap will be broken
        // (likely because they apply node.js path.resolve)
        // they could either use an other resolution system
        // or provide the ability to change how it's resolved
        // so that the sourcemap.sources does not get broken

        // rollup works with operating system path
        // return os path when possible
        // to ensure we can predict sourcemap.sources returned by rollup
        const importPath = fileUrlToPath(importUrl)
        if (importUrl in importReplaceMap) {
          return importPath
        }
        // file presence is optionnal
        if (importUrl in importFallbackMap) {
          return importPath
        }

        let stats
        try {
          stats = statSync(importPath)
        } catch (e) {
          if (e.code === "ENOENT") {
            throw new Error(`import file not found.
--- path ---
${importPath}
--- specifier ---
${specifier}
--- importer ---
${importer}`)
          }
          throw e
        }

        if (!stats.isFile()) {
          throw new Error(`unexpected import file stats.
--- path ---
${importPath}
--- found ---
${stats.isDirectory()} ? 'directory' : 'not-a-file'
--- specifier ---
${specifier}
--- importer ---
${importer}`)
        }

        return importPath
      }

      return importUrl
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {

    // },

    load: async (rollupId) => {
      const url = rollupIdToUrl(rollupId)
      logger.debug(`loading ${url}`)
      const { contentRaw, content, map } = await loadModule(url)

      moduleContentMap[url] = {
        content,
        contentRaw,
      }

      return { code: content, map }
    },

    // resolveImportMeta: () => {}

    transform: async (moduleContent, rollupId) => {
      const url = rollupIdToUrl(rollupId)

      if (arrayOfUrlToSkipTransform.includes(url)) {
        logger.debug(`skip transform for ${url}`)
        return null
      }

      logger.debug(`transform ${url}`)

      const { code, map } = await transformJs({
        projectDirectoryUrl,
        code: moduleContent,
        url,
        babelPluginMap,
        convertMap,
        // false, rollup will take care to transform module into whatever format
        transformModuleIntoSystemFormat: false,
      })
      return { code, map }
    },

    outputOptions: (options) => {
      // we want something like ../../../../file.js to become /file.js
      // and also rollup does not expects to have http dependency in the mix
      // so we fix them too (this one is really not mandatory)
      options.sourcemapPathTransform = (relativeSpecifier) => {
        const chunkFileUrl = resolveFileUrl(`./${chunkId}`, bundleDirectoryUrl)
        const url = resolveFileUrl(relativeSpecifier, chunkFileUrl)

        if (url.startsWith(projectDirectoryUrl)) {
          // relativise project dependencies
          const relativePath = fileUrlToRelativePath(url, projectDirectoryUrl)

          // yep rollup don't really support source being http
          if (relativePath.startsWith("http:/")) {
            return `http://${originRelativePath.slice(`http:/`.length)}`
          }
          if (relativePath.startsWith("https:/")) {
            return `https://${originRelativePath.slice(`http:/`.length)}`
          }

          const originRelativePath = `/${relativePath}`
          return originRelativePath
        }
        return url
      }
      return options
    },

    renderChunk: (source) => {
      if (!minify) return null

      // https://github.com/terser-js/terser#minify-options
      const minifyOptions = format === "global" ? { toplevel: false } : { toplevel: true }
      const result = minifyCode(source, {
        sourceMap: true,
        ...minifyOptions,
      })
      if (result.error) {
        throw result.error
      } else {
        return result
      }
    },

    writeBundle: async (bundle) => {
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

  const markUrlAsAbstract = (url) => {
    if (!arrayOfAbstractUrl.includes(url)) {
      arrayOfAbstractUrl.push(url)
    }
  }

  const loadModule = async (moduleUrl) => {
    const { contentType, content, map } = await getModule(moduleUrl)

    if (contentType === "application/javascript") {
      return {
        contentRaw: content,
        content,
        map: await fetchSourcemap({
          cancellationToken,
          logger,
          moduleUrl,
          moduleContent: content,
        }),
      }
    }

    if (contentType === "application/json") {
      return {
        contentRaw: content,
        content: `export default ${content}`,
        map,
      }
    }

    if (contentType.startsWith("text/")) {
      return {
        contentRaw: content,
        content: `export default ${JSON.stringify(content)}`,
        map,
      }
    }

    logger.warn(`unexpected content-type for module.
--- content-type ---
${contentType}
--- expected content-types ---
"application/javascript"
"application/json"
"text/*"
--- module url ---
${moduleUrl}`)

    return {
      contentRaw: content,
      // fallback to text
      content: `export default ${JSON.stringify(content)}`,
      map,
    }
  }

  const getModule = async (moduleUrl) => {
    if (moduleUrl in importReplaceMap) {
      const generateSourceForImport = importReplaceMap[moduleUrl]
      if (typeof generateSourceForImport !== "function") {
        throw new Error(
          `specifierAbstractMap values must be functions, found ${generateSourceForImport} for ${moduleUrl}`,
        )
      }

      return generateAbstractModuleForImport(moduleUrl, generateSourceForImport)
    }

    const response = await fetchUrl(moduleUrl, { cancellationToken })
    const okValidation = validateResponseStatusIsOk(response)

    if (!okValidation.valid) {
      if (response.status === 404 && moduleUrl in importFallbackMap) {
        return generateAbstractModuleForImport(moduleUrl, importFallbackMap[moduleUrl])
      }
      throw new Error(okValidation.message)
    }

    return {
      contentType: response.headers["content-type"],
      content: response.body,
    }
  }

  const generateAbstractModuleForImport = async (url, generateSource) => {
    markUrlAsAbstract(url)

    const returnValue = await generateSource()
    const result = typeof returnValue === "string" ? { code: returnValue } : returnValue

    const { skipTransform, code, map } = result

    if (skipTransform) {
      arrayOfUrlToSkipTransform.push(url)
    }

    return {
      contentType: ressourceToContentType(hrefToPathname(url), defaultContentTypeMap),
      content: code,
      map,
    }
  }

  return {
    jsenvRollupPlugin,
    getExtraInfo: () => {
      return {
        arrayOfAbstractUrl,
        moduleContentMap,
      }
    },
  }
}

export const rollupIdToUrl = (rollupId) => {
  if (hasScheme(rollupId)) {
    return rollupId
  }

  return pathToFileUrl(rollupId)
}

const resolveSpecifierMap = (specifierMap, projectDirectoryUrl) => {
  const specifierMapResolved = {}
  Object.keys(specifierMap).forEach((specifier) => {
    const specifierResolved = resolveFileUrl(specifier, projectDirectoryUrl)
    specifierMapResolved[specifierResolved] = specifierMap[specifier]
  })
  return specifierMapResolved
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

      const { code, map } = await transformJs({
        projectDirectoryUrl,
        code: bundleInfo.code,
        url: pathToFileUrl(bundleFilename),
        map: bundleInfo.map,
        babelPluginMap: { [asyncPluginName]: babelPluginMap[asyncPluginName] },
        transformModuleIntoSystemFormat: false, // already done by rollup
        transformGenerator: false, // already done
      })

      const bundleFileUrl = resolveFileUrl(bundleFilename, bundleDirectoryUrl)

      await Promise.all([
        fileWrite(
          fileUrlToPath(bundleFileUrl),
          writeSourceMappingURL(code, `./${bundleFilename}.map`),
        ),
        fileWrite(fileUrlToPath(`${bundleFileUrl}.map`), JSON.stringify(map)),
      ])
    }),
  )
}
