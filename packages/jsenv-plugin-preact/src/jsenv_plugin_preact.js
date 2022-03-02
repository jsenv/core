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
      url = asUrlWithoutSearch(url)
      const prefreshEnabled = shouldEnablePrefresh(url)
      const { code, map } = await babelTransform({
        options: {
          plugins: [
            [
              "@babel/plugin-transform-react-jsx-development",
              {
                runtime: "automatic",
                importSource: "preact",
              },
            ],
            ["babel-plugin-transform-hook-names"],
            ...(prefreshEnabled ? ["@prefresh/babel-plugin"] : []),
          ],
        },
        url,
        content,
      })
      if (!prefreshEnabled) {
        return {
          content: code,
          sourcemap: map,
        }
      }
      const magicSource = createMagicSource({
        url,
        content: code,
      })
      const hasReg = /\$RefreshReg\$\(/.test(code)
      const hasSig = /\$RefreshSig\$\(/.test(code)
      if (!hasSig && !hasReg) {
        return {
          content: code,
          sourcemap: map,
        }
      }
      magicSource.prepend(`import { installPrefresh } from "@jsenv/plugin-preact/src/client/prefresh.js"
const __prefresh__ = installPrefresh(${JSON.stringify(url)})
`)
      if (hasReg) {
        magicSource.append(`
__prefresh__.end()
import.meta.hot.accept(__prefresh__.acceptCallback)`)
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
