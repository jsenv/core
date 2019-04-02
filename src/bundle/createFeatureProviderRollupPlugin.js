import { minify as minifyCode } from "terser"
import { transformAsync, buildExternalHelpers } from "@babel/core"
import { addNamed } from "@babel/helper-module-imports"
import { isNativeNodeModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { isNativeBrowserModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeBrowserModuleBareSpecifier.js"
import { uneval } from "@dmail/uneval"
import { babeConfigMapToBabelPluginArray } from "../jsCompile/babeConfigMapToBabelPluginArray.js"
import { createReplaceImportMetaBabelPlugin } from "./createReplaceImportMetaBabelPlugin.js"

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
  const babelPluginArray = babeConfigMapToBabelPluginArray(babelConfigMapSubset)

  babelPluginArray.unshift(createHelperImportInjectorBabelPlugin())

  const importMetaSource =
    target === "browser" ? createBrowserImportMetaSource() : createNodeImportMetaSource()
  const isNativeModuleSpecifier =
    target === "browser" ? isNativeBrowserModuleBareSpecifier : isNativeNodeModuleBareSpecifier
  const buildNativeModuleSource =
    target === "browser" ? buildBrowserNativeModuleSource : buildNodeNativeModuleSource

  const replaceImportMetaBabelPlugin = createReplaceImportMetaBabelPlugin({
    importMetaSource,
  })
  babelPluginArray.push(replaceImportMetaBabelPlugin)

  const babelRollupPlugin = {
    resolveId: (id) => {
      if (isNativeModuleSpecifier(id)) return id
      if (id === HELPER_FILENAME) return id
      return null
    },

    load: (id) => {
      if (isNativeModuleSpecifier(id)) {
        return buildNativeModuleSource(id)
      }
      if (id === HELPER_FILENAME) {
        // https://github.com/babel/babel/blob/master/packages/babel-core/src/tools/build-external-helpers.js#L1
        const allHelperCode = buildExternalHelpers(undefined, "module")
        return allHelperCode
      }
      return null
    },

    transform: async (source, filename) => {
      if (filename === HELPER_FILENAME) return null

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

const buildBrowserNativeModuleSource = () => {
  // we'll see when they will exists
  throw new Error(`not implemeted`)
}

const buildNodeNativeModuleSource = (id) => {
  // eslint-disable-next-line import/no-dynamic-require
  const namespace = require(id)
  return `const namespace = require(${uneval(id)})
${Object.getOwnPropertyNames(namespace)
  .map((name) => `export const ${name} = namespace[${uneval(name)}]`)
  .join("\n")}
export default namespace`
}

const createBrowserImportMetaSource = () => `{
  url: document.currentScript && document.currentScript.src || location.href
}`

const createNodeImportMetaSource = () => `{
  url: "file://" + __dirname.indexOf("\\\\") === -1 ? __dirname : "/" + __dirname.replace(/\\\\/g, "/"),
  require: require
}`

// for reference this is how it's done to reference
// a global babel helper object instead of using
// a named import
// https://github.com/babel/babel/blob/master/packages/babel-plugin-external-helpers/src/index.js

// named import approach found here:
// https://github.com/rollup/rollup-plugin-babel/blob/18e4232a450f320f44c651aa8c495f21c74d59ac/src/helperPlugin.js#L1
const createHelperImportInjectorBabelPlugin = () => {
  return {
    pre: (file) => {
      const cachedHelpers = {}
      file.set("helperGenerator", (name) => {
        if (!file.availableHelper(name)) {
          return undefined
        }

        if (cachedHelpers[name]) {
          return cachedHelpers[name]
        }

        // https://github.com/babel/babel/tree/master/packages/babel-helper-module-imports
        const helper = addNamed(file.path, name, HELPER_FILENAME)
        cachedHelpers[name] = helper
        return helper
      })
    },
  }
}
