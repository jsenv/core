/*
 * - https://github.com/vitejs/vite/blob/main/packages/plugin-react/src/index.ts
 */

import { normalizeStructuredMetaMap, urlToMeta } from "@jsenv/url-meta"

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { composeTwoSourcemaps } from "@jsenv/utils/sourcemap/sourcemap_composition_v3.js"
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs"

import { jsenvPluginReactRefreshPreamble } from "./jsenv_plugin_react_refresh_preamble.js"

export const jsenvPluginReact = ({
  asJsModuleLogLevel,
  hotRefreshPatterns,
} = {}) => {
  return [
    jsenvPluginCommonJs({
      logLevel: asJsModuleLogLevel,
      include: {
        "**/node_modules/react/": true,
        "**/node_modules/react-dom/": { external: ["react"] },
        "**/node_modules/react/jsx-runtime/": { external: ["react"] },
        "**/node_modules/react/jsx-dev-runtime": { external: ["react"] },
        "**/react-refresh/": { external: ["react"] },
      },
    }),
    jsenvPluginReactRefreshPreamble(),
    jsenvPluginJsxAndRefresh({
      hotRefreshPatterns,
    }),
  ]
}

const jsenvPluginJsxAndRefresh = ({
  jsxInclude = {
    "./**/*.jsx": true,
    "./**/*.tsx": true,
  },
  refreshInclude = {
    "./**/*.jsx": true,
    "./**/*.tsx": true,
  },
}) => {
  const structuredMetaMap = normalizeStructuredMetaMap(
    {
      jsx: jsxInclude,
      refresh: refreshInclude,
    },
    "file://",
  )

  return {
    name: "jsenv:jsx_and_refresh",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo, { scenario, referenceUtils }) => {
        const urlMeta = urlToMeta({ url: urlInfo.url, structuredMetaMap })
        const jsxEnabled = urlMeta.jsx
        const refreshEnabled = scenario === "dev" ? urlMeta.refresh : false
        const babelPlugins = [
          ...(jsxEnabled
            ? [
                [
                  scenario === "dev"
                    ? "@babel/plugin-transform-react-jsx-development"
                    : "@babel/plugin-transform-react-jsx",
                  {
                    runtime: "automatic",
                    importSource: "react",
                  },
                ],
              ]
            : []),
          ...(refreshEnabled
            ? [["react-refresh/babel", { skipEnvCheck: true }]]
            : []),
        ]
        const { code, map } = await applyBabelPlugins({
          babelPlugins,
          urlInfo,
        })
        const magicSource = createMagicSource(code)
        if (jsxEnabled) {
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
