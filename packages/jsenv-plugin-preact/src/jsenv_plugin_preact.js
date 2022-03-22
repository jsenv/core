/*
 * - https://github.com/preactjs/preset-vite/blob/main/src/index.ts
 * - https://github.com/preactjs/prefresh/blob/main/packages/vite/src/index.js
 */

import { normalizeStructuredMetaMap, urlToMeta } from "@jsenv/url-meta"

import { applyBabelPlugins } from "@jsenv/core/src/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/core/src/utils/sourcemap/magic_source.js"
import { composeTwoSourcemaps } from "@jsenv/core/src/utils/sourcemap/sourcemap_composition.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"

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
  const shouldEnablePrefresh = (url) => {
    return urlToMeta({ url, structuredMetaMap }).hot
  }

  return {
    name: "jsenv:preact",
    appliesDuring: "*",
    resolve: {
      js_import_export: (reference, { resolveReference }) => {
        if (
          reference.specifier === "react" ||
          reference.specifier === "react-dom"
        ) {
          reference.specifier = "preact/compat"
          return resolveReference(reference).url
        }
        return null
      },
    },
    transform: {
      html: ({ content }, { scenario, addReference }) => {
        if (!preactDevtoolsDuringBuild && scenario === "build") {
          return null
        }
        const htmlAst = parseHtmlString(content)
        const preactDevtoolsReference = addReference({
          type: "js_import_export",
          specifier:
            scenario === "dev" || scenario === "test"
              ? "preact/debug"
              : "preact/devtools",
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            textContent: `
import "${preactDevtoolsReference.generatedSpecifier}"
`,
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return { content: htmlModified }
      },
      js_module: async (
        { url, generatedUrl, content },
        { scenario, addReference },
      ) => {
        //   case "Fragment":
        //   return `${source}/${development ? "jsx-dev-runtime" : "jsx-runtime"}`;
        // case "jsxDEV":
        //   return `${source}/jsx-dev-runtime`;
        // case "jsx":
        // case "jsxs":
        //   return `${source}/jsx-runtime`;
        // case "createElement":
        //   return source;
        const prefreshEnabled =
          scenario === "dev" ? shouldEnablePrefresh(url) : false
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
            ...(prefreshEnabled ? ["@prefresh/babel-plugin"] : []),
          ],
          url,
          generatedUrl,
          content,
        })
        const magicSource = createMagicSource({
          url,
          content: code,
        })
        // When a plugin wants to inject import, it must use "generatedSpecifier" returned by "addReference":
        // const preactJsxRuntimeReference = addReference({
        //   type: "js_import_export",
        //   specifier: "preact/jsx-runtime"
        // })
        // console.log(preactJsxRuntimeReference.generatedSpecifier)
        // -> "/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js"
        // Here "@babel/plugin-transform-react-jsx" is injecting some of these 3 imports into the code:
        // 1. import { jsx } from "preact/jsx-runtime"
        // 2. import { jsxDev } from "preact/jsx-dev-runtime"
        // 3. import { createElement } from "preact"
        // see https://github.com/babel/babel/blob/410c9acf1b9212cac69d50b5bb2015b9f372acc4/packages/babel-plugin-transform-react-jsx/src/create-plugin.ts#L743-L755
        // "@babel/plugin-transform-react-jsx" cannot be configured to inject
        // "/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js" instead of "preact/jsx-runtime"
        // But that's fine we can still replace these imports afterwards as done below
        const injectedSpecifiers = [
          `"preact"`,
          `"preact/jsx-dev-runtime"`,
          `"preact/jsx-runtime"`,
        ]
        for (const importSpecifier of injectedSpecifiers) {
          const index = code.indexOf(importSpecifier)
          if (index > -1) {
            magicSource.replace({
              start: index,
              end: index + importSpecifier.length,
              replacement: `"${
                addReference({
                  type: "js_import_export",
                  specifier: importSpecifier.slice(1, -1),
                }).generatedSpecifier
              }"`,
            })
          }
        }
        if (prefreshEnabled) {
          const hasReg = /\$RefreshReg\$\(/.test(code)
          const hasSig = /\$RefreshSig\$\(/.test(code)
          if (hasReg || hasSig) {
            const prefreshClientFileReference = addReference({
              type: "js_import_export",
              specifier: "@jsenv/plugin-preact/src/client/prefresh.js",
            })
            magicSource.prepend(`import { installPrefresh } from "${
              prefreshClientFileReference.generatedSpecifier
            }"
            const __prefresh__ = installPrefresh(${JSON.stringify(url)})
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
          sourcemap: composeTwoSourcemaps(map, result.sourcemap),
        }
      },
    },
  }
}
