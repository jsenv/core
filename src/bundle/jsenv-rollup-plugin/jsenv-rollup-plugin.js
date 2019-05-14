/* eslint-disable import/max-dependencies */
import { resolve } from "url"
import { fileRead, fileWrite } from "@dmail/helper"
import { createOperation } from "@dmail/cancellation"
import {
  resolveImport,
  remapResolvedImport,
  hrefToPathname,
  hrefToScheme,
} from "@jsenv/module-resolution"
import { fetchUsingHttp } from "../../node-platform-service/node-platform/fetchUsingHttp.js"
import { readSourceMappingURL, writeSourceMappingURL } from "../../source-mapping-url.js"
import {
  transpiler,
  findAsyncPluginNameInBabelConfigMap,
} from "../../compiled-js-service/transpiler.js"
import { readProjectImportMap } from "../../import-map/readProjectImportMap.js"
import { computeBabelConfigMapSubset } from "./computeBabelConfigMapSubset.js"
import { createLogger } from "../../logger.js"

const { minify: minifyCode } = import.meta.require("terser")
const { buildExternalHelpers } = import.meta.require("@babel/core")

const HELPER_FILENAME = "\0rollupPluginBabelHelpers.js"

export const createJsenvRollupPlugin = ({
  cancellationToken,
  projectFolder,
  importMapFilenameRelative,
  inlineSpecifierMap,
  origin = "http://example.com",

  featureNameArray,
  babelConfigMap,
  minify,
  target,
  detectAndTransformIfNeededAsyncInsertedByRollup = target === "browser",
  dir,
  logLevel,
}) => {
  const { log } = createLogger({ logLevel })

  const projectImportMap = readProjectImportMap({
    projectFolder,
    importMapFilenameRelative,
  })
  const importMap = projectImportMap

  const babelConfigMapSubset = computeBabelConfigMapSubset({
    HELPER_FILENAME,
    featureNameArray,
    babelConfigMap,
    target,
  })

  // https://github.com/babel/babel/blob/master/packages/babel-core/src/tools/build-external-helpers.js#L1
  inlineSpecifierMap[HELPER_FILENAME] = () => buildExternalHelpers(undefined, "module")

  const inlineImportMap = {}

  const jsenvRollupPlugin = {
    name: "jsenv",

    resolveId: (specifier, importer) => {
      if (specifier in inlineSpecifierMap) {
        const inlineSpecifier = inlineSpecifierMap[specifier]
        if (typeof inlineSpecifier === "string") return inlineSpecifier
        if (typeof inlineSpecifier === "function") {
          inlineImportMap[specifier] = inlineSpecifier
          return specifier
        }
        throw new Error(`inlineSpecifier must be a string or a function`)
      }

      if (!importer) return `${projectFolder}/${specifier}`

      let importerHref
      // there is already a scheme (http, https, file), keep it
      // it means there is an absolute import starting with file:// or http:// for instance.
      if (hrefToScheme(importer)) {
        importerHref = importer
      }
      // 99% of the time importer is a pathname
      // if the importer is inside projectFolder we must remove that
      // so that / is resolved against projectFolder and not the filesystem root
      else if (importer.startsWith(`${projectFolder}/`)) {
        importerHref = `${origin}${importer.slice(projectFolder.length)}`
      } else {
        importerHref = `${origin}${importer}`
      }

      const resolvedImport = resolveImport({
        importer: importerHref,
        specifier,
      })

      const id = remapResolvedImport({
        importMap,
        importerHref,
        resolvedImport,
      })

      // rollup works with pathname
      // le's return him pathname when possible
      // otherwise sourcemap.sources will be messed up
      if (id.startsWith(`${origin}/`)) {
        const specifierFilename = hrefToPathname(id)
        if (importer.startsWith(`${projectFolder}/`)) {
          const filename = `${projectFolder}${specifierFilename}`
          return filename
        }
        return specifierFilename
      }

      return id
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {

    // },

    load: async (id) => {
      if (id in inlineImportMap) return inlineImportMap[id]()

      const href = id[0] === "/" ? `file://${id}` : id
      const source = await fetchHref(href)

      const sourceMappingURL = readSourceMappingURL(source)
      if (!sourceMappingURL) return { code: source }

      const base64Prefix = "data:application/json;charset=utf-8;base64,"
      if (sourceMappingURL.startsWith(base64Prefix)) {
        const mapBase64Source = sourceMappingURL.slice(base64Prefix.length)
        const mapSource = new Buffer(mapBase64Source, "base64").toString("utf8")
        return { code: source, map: JSON.parse(mapSource) }
      }

      const resolvedSourceMappingURL = resolve(href, sourceMappingURL)
      const mapSource = await fetchHref(resolvedSourceMappingURL)

      return { code: source, map: JSON.parse(mapSource) }
    },

    transform: async (source, filename) => {
      if (filename === HELPER_FILENAME) return null
      if (filename.endsWith(".json")) {
        return {
          code: `export default ${source}`,
          map: { mappings: "" },
        }
      }

      const { code, map } = await transpiler({
        input: source,
        filename,
        babelConfigMap: babelConfigMapSubset,
        // false, rollup will take care to transform module into whatever format
        transformModuleIntoSystemFormat: false,
      })
      return { code, map }
    },

    renderChunk: (source) => {
      if (!minify) return null

      // https://github.com/terser-js/terser#minify-options
      const minifyOptions = target === "browser" ? { toplevel: false } : { toplevel: true }
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
        await transformAsyncInsertedByRollup({ dir, babelConfigMapSubset, bundle })
      }

      Object.keys(bundle).forEach((bundleFilename) => {
        log(`-> ${dir}/${bundleFilename}`)
      })
    },
  }

  const fetchHref = async (href) => {
    // this code allow you to have http/https dependency for convenience
    // but maybe we should warn about this.
    // it could also be vastly improved using a basic in memory cache
    if (href.startsWith("http://")) {
      const response = await fetchUsingHttp(href, { cancellationToken })
      ensureResponseSuccess(response)
      return response.body
    }

    if (href.startsWith("https://")) {
      const response = await fetchUsingHttp(href, { cancellationToken })
      ensureResponseSuccess(response)
      return response.body
    }

    if (href.startsWith("file:///")) {
      const code = await createOperation({
        cancellationToken,
        start: () => fileRead(hrefToPathname(href)),
      })
      return code
    }

    return ""
  }

  const ensureResponseSuccess = ({ url, status }) => {
    if (status < 200 || status > 299) {
      throw new Error(`unexpected response status for ${url}, got ${status}`)
    }
  }

  return jsenvRollupPlugin
}

const transformAsyncInsertedByRollup = async ({ dir, babelConfigMapSubset, bundle }) => {
  const asyncPluginName = findAsyncPluginNameInBabelConfigMap(babelConfigMapSubset)

  if (!asyncPluginName) return

  // we have to do this because rollup ads
  // an async wrapper function without transpiling it
  // if your bundle contains a dynamic import
  await Promise.all(
    Object.keys(bundle).map(async (bundleFilename) => {
      const bundleInfo = bundle[bundleFilename]

      const { code, map } = await transpiler({
        input: bundleInfo.code,
        inputMap: bundleInfo.map,
        filename: bundleFilename,
        babelConfigMap: { [asyncPluginName]: babelConfigMapSubset[asyncPluginName] },
        transformModuleIntoSystemFormat: false, // already done by rollup
      })

      await Promise.all([
        fileWrite(
          `${dir}/${bundleFilename}`,
          writeSourceMappingURL(code, `./${bundleFilename}.map`),
        ),
        fileWrite(`${dir}/${bundleFilename}.map`, JSON.stringify(map)),
      ])
    }),
  )
}
