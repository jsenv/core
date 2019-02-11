import { resolve } from "url"
import { rollup } from "rollup"
import createRollupBabelPlugin from "rollup-plugin-babel"
import { resolveImport } from "@jsenv/module-resolution"
import { fileRead } from "@dmail/helper"
import { compileMapToBabelPlugins } from "./compileMapToBabelPlugins.js"
import { fetchUsingHttp } from "../platform/node/fetchUsingHttp.js"
import { readSourceMappingURL } from "../replaceSourceMappingURL.js"

export const generateEntryFoldersForPlatform = async ({
  localRoot,
  bundleInto,
  entryPointObject,
  compileMap,
  compileParamMap,
  rollupOptions,
}) => {
  await Promise.all(
    Object.keys(compileMap).map((compileId) => {
      return generateEntryFolderForPlatform({
        localRoot,
        bundleInto,
        entryPointObject,
        compileId,
        compileIdPluginMap: compileParamMap[compileId].pluginMap,
        rollupOptions,
      })
    }),
  )
}

const generateEntryFolderForPlatform = async ({
  localRoot,
  bundleInto,
  entryPointObject,
  compileId,
  compileIdPluginMap,
  rollupOptions,
}) => {
  const rollupJsenvPlugin = {
    name: "jsenv",
    resolveId: (importee, importer) => {
      const root = `file://${localRoot}`
      // hotfix because entry file has no importer
      // so it would be resolved against root which is a folder
      // and url resolution would not do what we expect
      if (!importer) return `${root}/${importee}`

      const id = resolveImport({
        root,
        importer,
        specifier: importee,
        useNodeModuleResolutionOnRelative: false,
        // once you have decided to bundle using jsenv
        // you must stick to jsenv module resolution
        // so that jsenv knows where to find the source file to bundle
        // because it will bundle node_modules as well
        // (to get proper babel plugin applied)
        // but won't rely on stuff like having a module inside your package.json
        useNodeModuleResolutionInsideDedicatedFolder: true,
      })
      return id
    },

    load: async (href) => {
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
  }

  const fetchHref = async (href) => {
    if (href.startsWith("http://")) {
      const response = await fetchUsingHttp(href)
      ensureResponseSuccess(response)
      return response.body
    }
    if (href.startsWith("https://")) {
      const response = await fetchUsingHttp(href)
      ensureResponseSuccess(response)
      return response.body
    }
    if (href.startsWith("file:///")) {
      const code = await fileRead(href.slice("file://".length))
      return code
    }

    return ""
  }

  const ensureResponseSuccess = ({ url, status }) => {
    if (status < 200 || status > 299) {
      throw new Error(`unexpected response status for ${url}, got ${status}`)
    }
  }

  const babelPlugins = compileMapToBabelPlugins(compileIdPluginMap)

  // https://github.com/rollup/rollup-plugin-babel
  const rollupBabelPlugin = createRollupBabelPlugin({
    babelrc: false,
    plugins: babelPlugins,
    parserOpts: {
      allowAwaitOutsideFunction: true,
    },
  })

  const options = {
    input: entryPointObject,
    plugins: [rollupJsenvPlugin, rollupBabelPlugin],
    // skip rollup warnings
    onwarn: () => {},
    experimentalTopLevelAwait: true,
  }
  const rollupBundle = await rollup(options)

  const result = await rollupBundle.write({
    // https://rollupjs.org/guide/en#output-dir
    dir: `${localRoot}/${bundleInto}/${compileId}`,
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources: true,
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    experimentalTopLevelAwait: true,
    ...rollupOptions,
  })

  return result
}
