/*
 * - https://github.com/preactjs/preset-vite/blob/main/src/index.ts
 * - https://github.com/preactjs/prefresh/blob/main/packages/vite/src/index.js
 */

import { normalizeStructuredMetaMap, urlToMeta } from "@jsenv/url-meta"

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { composeTwoSourcemaps } from "@jsenv/utils/sourcemap/sourcemap_composition_v3.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/utils/html_ast/html_ast.js"

export const jsenvPluginPreact = ({
  hotRefreshPatterns = {
    "./**/*.jsx": true,
    "./**/*.tsx": true,
    "./**/node_modules/": false,
  },
  preactDevtoolsDuringBuild = false,
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
    name: "jsenv:preact",
    appliesDuring: "*",
    resolveUrl: {
      js_import_export: (reference, context) => {
        if (
          reference.specifier === "react" ||
          reference.specifier === "react-dom"
        ) {
          reference.specifier = "preact/compat"
          return context.resolveReference(reference).url
        }
        return null
      },
    },
    transformUrlContent: {
      html: ({ content }, { scenario, referenceUtils }) => {
        if (!preactDevtoolsDuringBuild && scenario === "build") {
          return null
        }
        const htmlAst = parseHtmlString(content)
        const [preactDevtoolsReference] = referenceUtils.inject({
          type: "js_import_export",
          expectedType: "js_module",
          specifier:
            scenario === "dev" || scenario === "test"
              ? "preact/debug"
              : "preact/devtools",
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "type": "module",
            "textContent": `
import ${preactDevtoolsReference.generatedSpecifier}
`,
            "injected-by": "jsenv:preact",
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return { content: htmlModified }
      },
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
            ...(hotRefreshEnabled ? ["@prefresh/babel-plugin"] : []),
          ],
          urlInfo,
        })
        const magicSource = createMagicSource(code)
        // "@babel/plugin-transform-react-jsx" is injecting some of these 3 imports into the code:
        // 1. import { jsx } from "preact/jsx-runtime"
        // 2. import { jsxDev } from "preact/jsx-dev-runtime"
        // 3. import { createElement } from "preact"
        // see https://github.com/babel/babel/blob/410c9acf1b9212cac69d50b5bb2015b9f372acc4/packages/babel-plugin-transform-react-jsx/src/create-plugin.ts#L743-L755
        // "@babel/plugin-transform-react-jsx" cannot be configured to inject what we want
        // ("/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js" instead of "preact/jsx-runtime")
        // but that's fine we can still replace these imports afterwards as done below.
        const injectedSpecifiers = [
          `"preact"`,
          `"preact/jsx-dev-runtime"`,
          `"preact/jsx-runtime"`,
        ]
        for (const importSpecifier of injectedSpecifiers) {
          const index = code.indexOf(importSpecifier)
          if (index > -1) {
            const [injectedReference] = referenceUtils.inject({
              type: "js_import_export",
              expectedType: "js_module",
              specifier: importSpecifier.slice(1, -1),
            })
            magicSource.replace({
              start: index,
              end: index + importSpecifier.length,
              replacement: injectedReference.generatedSpecifier,
            })
          }
        }
        if (hotRefreshEnabled) {
          const hasReg = /\$RefreshReg\$\(/.test(code)
          const hasSig = /\$RefreshSig\$\(/.test(code)
          if (hasReg || hasSig) {
            const [preactRefreshClientReference] = referenceUtils.inject({
              type: "js_import_export",
              expectedType: "js_module",
              specifier: "@jsenv/plugin-preact/src/client/preact_refresh.js",
            })
            magicSource.prepend(`import { installPreactRefresh } from ${
              preactRefreshClientReference.generatedSpecifier
            }
const __preact_refresh__ = installPreactRefresh(${JSON.stringify(urlInfo.url)})
`)
            if (hasReg) {
              magicSource.append(`
__preact_refresh__.end()
import.meta.hot.accept(__preact_refresh__.acceptCallback)`)
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
