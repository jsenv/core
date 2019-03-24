import { transformAsync, buildExternalHelpers } from "@babel/core"
import { addNamed } from "@babel/helper-module-imports"
import { minify as minifyCode } from "terser"
import { babelPluginDescriptionToBabelPluginArray } from "../jsCompile/babelPluginDescriptionToBabelPluginArray.js"

const HELPER_FILENAME = "rollupPluginBabelHelpers.js"

export const babelPluginDescriptionToRollupPlugin = ({
  babelPluginDescription,
  minify,
  minifyOptions,
}) => {
  const babelPluginArray = babelPluginDescriptionToBabelPluginArray(babelPluginDescription)

  babelPluginArray.unshift(createHelperImportInjectorBabelPlugin())

  const babelRollupPlugin = {
    resolveId: (id) => {
      if (id === HELPER_FILENAME) {
        return id
      }
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

    renderChunk: (code) => {
      if (!minify) return null

      // https://github.com/terser-js/terser#minify-options
      const result = minifyCode(code, { sourceMap: true, ...(minifyOptions || {}) })
      if (result.error) {
        throw result.error
      } else {
        return result
      }
    },
  }

  return babelRollupPlugin
}

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
