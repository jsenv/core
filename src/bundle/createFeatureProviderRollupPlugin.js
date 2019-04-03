import { babelConfigMapToBabelPluginArray } from "../jsCompile/babeConfigMapToBabelPluginArray.js"
import { createReplaceImportMetaBabelPlugin } from "./createReplaceImportMetaBabelPlugin.js"
import { createReplaceHelperByImportBabelPlugin } from "./createReplaceHelperByImportBabelPlugin.js"

const { minify: minifyCode } = import.meta.require("terser")
const { transformAsync, buildExternalHelpers } = import.meta.require("@babel/core")

const HELPER_FILENAME = "\0rollupPluginBabelHelpers.js"

export const createFeatureProviderRollupPlugin = ({
  featureNameArray,
  babelConfigMap,
  minify,
  target,
}) => {
  const babelConfigMapSubset = filterBabelConfigMap(babelConfigMap, (babelPluginName) =>
    featureNameArray.includes(babelPluginName),
  )
  const babelPluginArray = babelConfigMapToBabelPluginArray(babelConfigMapSubset)

  babelPluginArray.unshift(createReplaceHelperByImportBabelPlugin({ HELPER_FILENAME }))

  const importMetaSource =
    target === "browser" ? createBrowserImportMetaSource() : createNodeImportMetaSource()

  const replaceImportMetaBabelPlugin = createReplaceImportMetaBabelPlugin({
    importMetaSource,
  })
  babelPluginArray.push(replaceImportMetaBabelPlugin)

  const babelRollupPlugin = {
    resolveId: (id) => {
      if (id === HELPER_FILENAME) return id
      return null
    },

    load: (id) => {
      if (id === HELPER_FILENAME) {
        // https://github.com/babel/babel/blob/master/packages/babel-core/src/tools/build-external-helpers.js#L1
        const allHelperCode = buildExternalHelpers(undefined, "module")
        return allHelperCode
      }
      return null
    },

    transform: async (source, filename) => {
      if (filename === HELPER_FILENAME) return null
      if (filename.endsWith(".json")) {
        return {
          code: `export default ${source}`,
          map: { mappings: "" },
        }
      }

      const result = await transformAsync(source, {
        filename,
        babelrc: false,
        plugins: babelPluginArray,
        sourceMaps: true,
        parserOpts: {
          allowAwaitOutsideFunction: true,
        },
      })
      return result
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
  }

  return babelRollupPlugin
}

const filterBabelConfigMap = (babelConfigMap, filter) => {
  const filteredBabelConfigMap = {}
  Object.keys(babelConfigMap).forEach((babelPluginName) => {
    if (filter(babelPluginName)) {
      filteredBabelConfigMap[babelPluginName] = babelConfigMap[babelPluginName]
    }
  })
  return filteredBabelConfigMap
}

const createBrowserImportMetaSource = () => `{
  url: document.currentScript && document.currentScript.src || location.href
}`

const createNodeImportMetaSource = () => `{
  url: "file://" + __dirname.indexOf("\\\\") === -1 ? __dirname : "/" + __dirname.replace(/\\\\/g, "/"),
  require: require
}`
