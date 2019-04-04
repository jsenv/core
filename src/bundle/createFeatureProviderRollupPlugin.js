import { fileWrite } from "/node_modules/@dmail/helper/index.js"
import { createReplaceImportMetaBabelPlugin } from "./replace-import-meta.js"
import { createReplaceBabelHelperByNamedImportBabelPlugin } from "./replace-babel-helper-by-named-import.js"
import { transpiler, findAsyncPluginNameInBabelConfigMap } from "../jsCompile/transpiler.js"
import { writeSourceMapLocation } from "../jsCompile/jsCompile.js"

const { minify: minifyCode } = import.meta.require("terser")
const { buildExternalHelpers } = import.meta.require("@babel/core")

const HELPER_FILENAME = "\0rollupPluginBabelHelpers.js"

export const createFeatureProviderRollupPlugin = ({
  dir,
  featureNameArray,
  babelConfigMap,
  minify,
  target,
}) => {
  const replaceBabelHelperByNamedImportBabelPlugin = createReplaceBabelHelperByNamedImportBabelPlugin(
    {
      HELPER_FILENAME,
    },
  )
  const replaceImportMetaBabelPlugin = createReplaceImportMetaBabelPlugin({
    importMetaSource:
      target === "browser" ? createBrowserImportMetaSource() : createNodeImportMetaSource(),
  })

  const babelConfigMapSubset = {}
  babelConfigMapSubset[
    "replace-babel-helper-by-named-import"
  ] = replaceBabelHelperByNamedImportBabelPlugin
  Object.keys(babelConfigMap).forEach((babelPluginName) => {
    if (featureNameArray.includes(babelPluginName)) {
      babelConfigMapSubset[babelPluginName] = babelConfigMap[babelPluginName]
    }
  })
  babelConfigMapSubset["replace-import-meta"] = [replaceImportMetaBabelPlugin]

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

      const { code, map } = await transpiler({
        input: source,
        filename,
        babelConfigMap: babelConfigMapSubset,
        // false, will be done inside writeBundle
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
            transformModuleIntoSystemFormat: false,
          })

          await Promise.all([
            fileWrite(
              `${dir}/${bundleFilename}`,
              writeSourceMapLocation({ source: code, location: `./${bundleFilename}.map` }),
            ),
            fileWrite(`${dir}/${bundleFilename}.map`, JSON.stringify(map)),
          ])
        }),
      )
    },
  }

  return babelRollupPlugin
}

const createBrowserImportMetaSource = () => `{
  url: document.currentScript && document.currentScript.src || location.href
}`

const createNodeImportMetaSource = () => `{
  url: "file://" + __dirname.indexOf("\\\\") === -1 ? __dirname : "/" + __dirname.replace(/\\\\/g, "/"),
  require: require
}`
