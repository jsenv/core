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
import {
  pathnameToOperatingSystemPath,
  operatingSystemPathToPathname,
  pathnameIsInside,
  pathnameToRelativePathname,
  isWindowsPath,
} from "@jsenv/operating-system-path"
import { fetchUsingHttp } from "../../node-platform-service/node-platform/fetchUsingHttp.js"
import { readSourceMappingURL, writeSourceMappingURL } from "../../source-mapping-url.js"
import {
  transpiler,
  findAsyncPluginNameInbabelPluginMap,
} from "../../compiled-js-service/transpiler.js"
import { readProjectImportMap } from "../../import-map/readProjectImportMap.js"
import { createLogger } from "../../logger.js"
import { computeBabelPluginMapSubset } from "./computeBabelPluginMapSubset.js"
import { createBundleBabelPluginMap } from "./create-bundle-babel-plugin-map.js"
import { relativePathInception } from "/src/inception.js"

const { minify: minifyCode } = import.meta.require("terser")
const { buildExternalHelpers } = import.meta.require("@babel/core")

const BABEL_HELPERS_FACADE_PATH = "/.jsenv/babelHelpers.js"
const GLOBAL_THIS_FACADE_PATH = "/.jsenv/helpers/global-this.js"
const GLOBAL_THIS_FILESYSTEM_RELATIVE_PATH = "/src/bundling/jsenv-rollup-plugin/global-this.js"

export const createJsenvRollupPlugin = ({
  cancellationToken,
  projectPathname,
  importMapRelativePath,
  inlineSpecifierMap,
  origin = "http://example.com",

  featureNameArray,
  babelPluginMap: allBabelPluginMap,
  minify,
  format,
  detectAndTransformIfNeededAsyncInsertedByRollup = format === "global",
  dir,
  logLevel,
}) => {
  const { log } = createLogger({ logLevel })

  const projectImportMap = readProjectImportMap({
    projectPathname,
    importMapRelativePath,
  })
  const importMap = projectImportMap

  const globalThisFilesystemPath = pathnameToOperatingSystemPath(
    `${projectPathname}${relativePathInception({
      projectPathname,
      relativePath: GLOBAL_THIS_FILESYSTEM_RELATIVE_PATH,
    })}`,
  )
  const babelPluginMap = {
    ...computeBabelPluginMapSubset({
      babelPluginMap: allBabelPluginMap,
      featureNameArray,
    }),
    ...createBundleBabelPluginMap({
      projectPathname,
      format,
      globalThisFacadePath: GLOBAL_THIS_FACADE_PATH,
      globalThisFilesystemPath,
      babelHelpersFacadePath: BABEL_HELPERS_FACADE_PATH,
    }),
  }

  inlineSpecifierMap[GLOBAL_THIS_FACADE_PATH] = globalThisFilesystemPath
  // https://github.com/babel/babel/blob/master/packages/babel-core/src/tools/build-external-helpers.js#L1
  inlineSpecifierMap[BABEL_HELPERS_FACADE_PATH] = () => buildExternalHelpers(undefined, "module")

  const inlineSpecifierResolveMap = {}

  const jsenvRollupPlugin = {
    name: "jsenv",

    resolveId: (specifier, importer) => {
      if (specifier in inlineSpecifierMap) {
        const inlineSpecifier = inlineSpecifierMap[specifier]
        if (typeof inlineSpecifier === "string")
          return pathnameToOperatingSystemPath(inlineSpecifier)
        if (typeof inlineSpecifier === "function") {
          const osPath = pathnameToOperatingSystemPath(`${projectPathname}${specifier}`)
          inlineSpecifierResolveMap[osPath] = specifier
          return osPath
        }
        throw new Error(`inlineSpecifier must be a string or a function`)
      }

      if (!importer) {
        if (specifier[0] === "/") specifier = specifier.slice(1)
        return pathnameToOperatingSystemPath(`${projectPathname}/${specifier}`)
      }

      let importerHref
      const hasSheme = isWindowsPath(importer) ? false : Boolean(hrefToScheme(importer))
      // there is already a scheme (http, https, file), keep it
      // it means there is an absolute import starting with file:// or http:// for instance.
      if (hasSheme) {
        importerHref = importer
      }
      // 99% of the time importer is an operating system path
      // here we ensure / is resolved against project by forcing an url resolution
      // prefixing with origin
      else {
        const importerPathname = operatingSystemPathToPathname(importer)
        const isInsideProject = pathnameIsInside(importerPathname, projectPathname)
        if (!isInsideProject) {
          throw new Error(`importer must be inside project
importer: ${importer}
project: ${pathnameToOperatingSystemPath(projectPathname)}`)
        }

        importerHref = `${origin}${pathnameToRelativePathname(importerPathname, projectPathname)}`
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

      // rollup works with operating system path
      // return os path when possible
      // to ensure we can predict sourcemap.sources returned by rollup
      const resolvedIdIsInsideProject = id.startsWith(`${origin}/`)
      if (resolvedIdIsInsideProject) {
        const idPathname = hrefToPathname(id)
        return pathnameToOperatingSystemPath(`${projectPathname}${idPathname}`)
      }

      return id
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {

    // },

    load: async (id) => {
      if (id in inlineSpecifierResolveMap) {
        return inlineSpecifierMap[inlineSpecifierResolveMap[id]]()
      }

      const hasSheme = isWindowsPath(id) ? false : Boolean(hrefToScheme(id))
      const href = hasSheme ? id : `file://${operatingSystemPathToPathname(id)}`
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

    transform: async (source, id) => {
      // babel helper must not be retransformed
      if (
        id in inlineSpecifierResolveMap &&
        inlineSpecifierResolveMap[id] === BABEL_HELPERS_FACADE_PATH
      ) {
        return null
      }
      if (id.endsWith(".json")) {
        return {
          code: `export default ${source}`,
          map: { mappings: "" },
        }
      }

      const hasSheme = isWindowsPath(id) ? false : Boolean(hrefToScheme(id))
      let filename
      let filenameRelative
      if (hasSheme) {
        filename = id
      } else {
        filename = id
        const filePathname = operatingSystemPathToPathname(id)
        filenameRelative = pathnameToRelativePathname(filePathname, projectPathname).slice(1)
      }

      const { code, map } = await transpiler({
        input: source,
        filename,
        filenameRelative,
        babelPluginMap,
        // false, rollup will take care to transform module into whatever format
        transformModuleIntoSystemFormat: false,
      })
      return { code, map }
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
        await transformAsyncInsertedByRollup({ dir, babelPluginMap, bundle })
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
        start: () => fileRead(pathnameToOperatingSystemPath(hrefToPathname(href))),
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

const transformAsyncInsertedByRollup = async ({ dir, babelPluginMap, bundle }) => {
  const asyncPluginName = findAsyncPluginNameInbabelPluginMap(babelPluginMap)

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
        babelPluginMap: { [asyncPluginName]: babelPluginMap[asyncPluginName] },
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
