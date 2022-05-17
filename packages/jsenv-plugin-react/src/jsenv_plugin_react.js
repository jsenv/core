/*
 * - https://github.com/preactjs/preset-vite/blob/main/src/index.ts
 * - https://github.com/preactjs/prefresh/blob/main/packages/vite/src/index.js
 */

import { normalizeStructuredMetaMap, urlToMeta } from "@jsenv/url-meta"

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { composeTwoSourcemaps } from "@jsenv/utils/sourcemap/sourcemap_composition_v3.js"

export const jsenvPluginReact = ({
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
  const shouldEnableHotRefresh = (url) => {
    return urlToMeta({ url, structuredMetaMap }).hot
  }

  return {
    name: "jsenv:react",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo, { scenario, referenceUtils }) => {
        const hotRefreshEnabled =
          scenario === "dev" ? shouldEnableHotRefresh(urlInfo.url) : false
        const hookNamesEnabled = scenario === "dev"
        const { code, map } = await applyBabelPlugins({
          babelPlugins: [
            [
              scenario === "dev"
                ? "@babel/plugin-transform-react-jsx-development"
                : "@babel/plugin-transform-react-jsx",
              {
                runtime: "automatic",
                importSource: "preact",
              },
            ],
            ...(hookNamesEnabled ? ["babel-plugin-transform-hook-names"] : []),
            ...(hotRefreshEnabled ? ["react-refresh/babel"] : []),
          ],
          urlInfo,
        })
        const magicSource = createMagicSource(code)
        // "@babel/plugin-transform-react-jsx" is injecting some of these 3 imports into the code:
        // 1. import { jsx } from "react/jsx-runtime"
        // 2. import { jsxDev } from "react/jsx-dev-runtime"
        // 3. import { createElement } from "react"
        // see https://github.com/babel/babel/blob/410c9acf1b9212cac69d50b5bb2015b9f372acc4/packages/babel-plugin-transform-react-jsx/src/create-plugin.ts#L743-L755
        // "@babel/plugin-transform-react-jsx" cannot be configured to inject what we want
        // but that's fine we can still replace these imports afterwards as done below
        const injectedSpecifiers = [
          `"react"`,
          `"react/jsx-dev-runtime"`,
          `"react/jsx-runtime"`,
        ]
        for (const importSpecifier of injectedSpecifiers) {
          const index = code.indexOf(importSpecifier)
          if (index > -1) {
            magicSource.replace({
              start: index,
              end: index + importSpecifier.length,
              replacement: referenceUtils.inject({
                type: "js_import_export",
                expectedType: "js_module",
                specifier: importSpecifier.slice(1, -1),
              }).generatedSpecifier,
            })
          }
        }
        if (hotRefreshEnabled) {
          const hasReg = /\$RefreshReg\$\(/.test(code)
          const hasSig = /\$RefreshSig\$\(/.test(code)
          if (hasReg || hasSig) {
            const refreshClientFileReference = referenceUtils.inject({
              type: "js_import_export",
              expectedType: "js_module",
              specifier: "@jsenv/plugin-react/src/client/refresh.js",
            })
            magicSource.prepend(`import { installPrefresh } from ${
              refreshClientFileReference.generatedSpecifier
            }
const __prefresh__ = installPrefresh(${JSON.stringify(urlInfo.url)})
`)
            if (hasReg) {
              magicSource.append(`
__prefresh__.end()
import.meta.hot.accept(__prefresh__.acceptCallback)`)
            }
          }
        }
        const result = magicSource.toContentAndSourcemap()
        return {
          content: result.content,
          sourcemap: await composeTwoSourcemaps(map, result.sourcemap),
        }
      },
    },
  }
}
