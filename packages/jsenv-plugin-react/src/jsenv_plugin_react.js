/*
 * - https://github.com/vitejs/vite/blob/main/packages/plugin-react/src/index.ts
 * TODO: transform the runtime to inject the following
 * - https://github.com/vitejs/vite/blob/0858450b2a258b216ae9aa797cc02e9a0d4eb0af/packages/plugin-react/src/fast-refresh.ts#L16-L26
 * and hmr should work
 */

import { normalizeStructuredMetaMap, urlToMeta } from "@jsenv/url-meta"

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { composeTwoSourcemaps } from "@jsenv/utils/sourcemap/sourcemap_composition_v3.js"
import { injectQueryParams } from "@jsenv/utils/urls/url_utils.js"
import { commonJsToJsModule } from "@jsenv/cjs-to-esm"
import { fetchOriginalUrlInfo } from "@jsenv/core/src/plugins/transpilation/fetch_original_url_info.js"

export const jsenvPluginReact = ({ hotRefreshPatterns } = {}) => {
  return [
    jsenvPluginReactAsJsModule(),
    jsenvPluginJsxAndRefresh({
      hotRefreshPatterns,
    }),
  ]
}

const jsenvPluginReactAsJsModule = () => {
  return {
    name: "jsenv:react_as_js_module",
    appliesDuring: "*",
    normalizeUrl: {
      js_import_export: (reference) => {
        if (
          [
            "react",
            "react-dom",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react-refresh",
          ].includes(reference.specifier)
        ) {
          return injectQueryParams(reference.url, {
            react_as_js_module: "",
          })
        }
        return null
      },
    },
    fetchUrlContent: async (urlInfo, context) => {
      const originalUrlInfo = await fetchOriginalUrlInfo({
        urlInfo,
        context,
        searchParam: "react_as_js_module",
      })
      if (!originalUrlInfo) {
        return null
      }
      const { content, sourcemap } = await commonJsToJsModule({
        rootDirectoryUrl: context.rootDirectoryUrl,
        sourceFileUrl: originalUrlInfo.url,
        external: ["react"],
      })
      return {
        type: "js_module",
        contentType: "text/javascript",
        content,
        sourcemap,
      }
    },
  }
}

const jsenvPluginJsxAndRefresh = ({
  refreshPatterns = {
    "./**/*.jsx": true,
    "./**/*.tsx": true,
    "./**/node_modules/": false,
  },
}) => {
  const structuredMetaMap = normalizeStructuredMetaMap(
    {
      refresh: refreshPatterns,
    },
    "file://",
  )
  const shouldEnableRefresh = (url) => {
    return urlToMeta({ url, structuredMetaMap }).refresh
  }

  return {
    name: "jsenv:react",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo, { scenario, referenceUtils }) => {
        const refreshEnabled =
          scenario === "dev" ? shouldEnableRefresh(urlInfo.url) : false
        const hookNamesEnabled = scenario === "dev"
        const { code, map } = await applyBabelPlugins({
          babelPlugins: [
            [
              scenario === "dev"
                ? "@babel/plugin-transform-react-jsx-development"
                : "@babel/plugin-transform-react-jsx",
              {
                runtime: "automatic",
                importSource: "react",
              },
            ],
            ...(hookNamesEnabled ? ["babel-plugin-transform-hook-names"] : []),
            ...(refreshEnabled
              ? [["react-refresh/babel", { skipEnvCheck: true }]]
              : []),
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
          let index = code.indexOf(importSpecifier)
          while (index > -1) {
            const specifier = importSpecifier.slice(1, -1)
            const [injectedReference] = referenceUtils.inject({
              type: "js_import_export",
              expectedType: "js_module",
              specifier,
            })
            magicSource.replace({
              start: index,
              end: index + importSpecifier.length,
              replacement: injectedReference.generatedSpecifier,
            })
            index = code.indexOf(importSpecifier, index + 1)
          }
        }
        if (refreshEnabled) {
          const hasReg = /\$RefreshReg\$\(/.test(code)
          const hasSig = /\$RefreshSig\$\(/.test(code)
          if (hasReg || hasSig) {
            const [reactRefreshClientReference] = referenceUtils.inject({
              type: "js_import_export",
              expectedType: "js_module",
              specifier: "@jsenv/plugin-react/src/client/react_refresh.js",
            })
            magicSource.prepend(`import { installReactRefresh } from ${
              reactRefreshClientReference.generatedSpecifier
            }
const __react_refresh__ = installReactRefresh(${JSON.stringify(urlInfo.url)})
`)
            if (hasReg) {
              magicSource.append(`
__react_refresh__.end()
import.meta.hot.accept(__react_refresh__.acceptCallback)`)
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
