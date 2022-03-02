/*
 * - https://github.com/preactjs/preset-vite/blob/main/src/index.ts
 * - https://github.com/preactjs/prefresh/blob/main/packages/vite/src/index.js
 */

import { normalizeStructuredMetaMap, urlToMeta } from "@jsenv/url-meta"

import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"
import { createMagicSource } from "@jsenv/core/omega/internal/sourcemap/magic_source.js"
import { composeTwoSourcemaps } from "@jsenv/core/src/internal/sourcemap/sourcemap_composition.js"
import { asUrlWithoutSearch } from "@jsenv/core/omega/internal/url_utils.js"

export const jsenvPluginPreact = ({
  hotRefreshPatterns = {
    "./**/*.jsx": true,
    "./**/*.tsx": true,
    "./**/node_modules/": false,
  },
} = {}) => {
  const structuredMetaMap = normalizeStructuredMetaMap(
    {
      hot: hotRefreshPatterns,
    },
    "file://",
  )
  const shouldEnablePrefresh = (url) => {
    return urlToMeta({ url, structuredMetaMap }).hot
  }
  const transformScenarios = {
    dev: async ({ url, content }) => {
      url = asUrlWithoutSearch(url) // for shouldEnablePrefresh

      const prefreshEnabled = shouldEnablePrefresh(url)
      const babelReturnValue = await babelTransform({
        options: {
          plugins: [
            [
              "@babel/plugin-transform-react-jsx",
              {
                runtime: "automatic",
                importSource: "preact",
              },
            ],
            ["babel-plugin-transform-hook-names"],
          ],
        },
        url,
        content,
      })
      if (!prefreshEnabled) {
        return {
          content: babelReturnValue.code,
          sourcemap: babelReturnValue.map,
        }
      }
      const { code, map } = await babelTransform({
        options: {
          plugins: [["@prefresh/babel-plugin"]],
        },
        url,
        content: babelReturnValue.code,
      })
      const magicSource = createMagicSource({
        url,
        content: code,
      })
      const hasReg = /\$RefreshReg\$\(/.test(code)
      const hasSig = /\$RefreshSig\$\(/.test(code)
      if (!hasSig && !hasReg) {
        return {
          content: babelReturnValue.code,
          sourcemap: babelReturnValue.map,
        }
      }
      magicSource.prepend(`import "@prefresh/core"
      import { flush } from "@prefresh/utils"

let prevRefreshReg = self.$RefreshReg$ || (() => {})
let prevRefreshSig = self.$RefreshSig$ || (() => (type) => type)
self.$RefreshReg$ = (type, id) => {
  self.__PREFRESH__.register(type, ${JSON.stringify(url)} + " " + id)
}
self.$RefreshSig$ = () => {
  let status = "begin"
  let savedType
  return (type, key, forceReset, getCustomHooks) => {
    if (!savedType) savedType = type
    status = self.__PREFRESH__.sign(
      type || savedType,
      key,
      forceReset,
      getCustomHooks,
      status,
    )
    return type
  }
}
`)
      if (hasReg) {
        magicSource.append(`
self.$RefreshReg$ = prevRefreshReg;
self.$RefreshSig$ = prevRefreshSig;
import.meta.hot.accept(() => {
  flush()
})`)
      }
      const result = magicSource.toContentAndSourcemap()
      return {
        content: result.content,
        map: composeTwoSourcemaps(map, result.sourcemap),
      }
    },
    other: async ({ url, content }) => {
      const { code, map } = await babelTransform({
        options: {
          plugins: [
            [
              "@babel/plugin-transform-react-jsx",
              {
                runtime: "automatic",
                importSource: "preact",
              },
            ],
          ],
        },
        url,
        content,
      })
      return {
        content: code,
        sourcemap: map,
      }
    },
  }

  return {
    name: "jsenv:preact",
    appliesDuring: {
      dev: true,
      test: true,
      preview: true,
      prod: true,
    },

    resolve: ({ resolve, parentUrl, specifierType, specifier }) => {
      if (specifierType !== "js_import_export") {
        return null
      }
      if (specifier === "react" || specifier === "react-dom") {
        return resolve({
          parentUrl,
          specifierType,
          specifier: "preact/compat",
        })
      }
      return null
    },

    transform: async ({ scenario, url, contentType, content }) => {
      if (contentType !== "application/javascript") {
        return null
      }
      const transform = transformScenarios[scenario === "dev" ? "dev" : "other"]
      return transform({
        url,
        content,
      })
    },
  }
}
