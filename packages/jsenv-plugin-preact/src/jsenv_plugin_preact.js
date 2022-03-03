/*
 * - https://github.com/preactjs/preset-vite/blob/main/src/index.ts
 * - https://github.com/preactjs/prefresh/blob/main/packages/vite/src/index.js
 */

import { normalizeStructuredMetaMap, urlToMeta } from "@jsenv/url-meta"

import { applyBabelPlugins } from "@jsenv/core/omega/internal/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/core/omega/internal/sourcemap/magic_source.js"
import { composeTwoSourcemaps } from "@jsenv/core/omega/internal/sourcemap/sourcemap_composition.js"
import { asUrlWithoutSearch } from "@jsenv/core/omega/internal/url_utils.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/core/omega/internal/html_ast/html_ast.js"

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
      js_import_export: ({ resolve, parentUrl, specifierType, specifier }) => {
        if (specifier === "react" || specifier === "react-dom") {
          return resolve({
            parentUrl,
            specifierType,
            specifier: "preact/compat",
          })
        }
        return null
      },
    },
    transform: {
      html: ({ scenario, content }) => {
        if (
          !preactDevtoolsDuringBuild &&
          (scenario === "preview" || scenario === "prod")
        ) {
          return null
        }
        const htmlAst = parseHtmlString(content)
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "type": "module",
            "textContent":
              scenario === "dev" || scenario === "test"
                ? `import "preact/debug"`
                : `import "preact/devtools"`,
            "data-injected": true,
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return { content: htmlModified }
      },
      js_module: async ({ scenario, url, content }) => {
        if (scenario === "dev") {
          url = asUrlWithoutSearch(url)
          const prefreshEnabled = shouldEnablePrefresh(url)
          const { code, map } = await applyBabelPlugins({
            babelPlugins: [
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
            url,
            content,
          })
          return prefreshEnabled
            ? applyHotRefreshInstrumentation({
                url,
                content: code,
                sourcemap: map,
              })
            : {
                content: code,
                sourcemap: map,
              }
        }
        const { code, map } = await applyBabelPlugins({
          babelPlugins: [
            [
              "@babel/plugin-transform-react-jsx",
              {
                runtime: "automatic",
                importSource: "preact",
              },
            ],
          ],
          url,
          content,
        })
        return {
          content: code,
          sourcemap: map,
        }
      },
    },
  }
}

const applyHotRefreshInstrumentation = ({ url, content, sourcemap }) => {
  const magicSource = createMagicSource({
    url,
    content,
  })
  const hasReg = /\$RefreshReg\$\(/.test(content)
  const hasSig = /\$RefreshSig\$\(/.test(content)
  if (!hasSig && !hasReg) {
    return {
      content,
      sourcemap,
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
    sourcemap: composeTwoSourcemaps(sourcemap, result.sourcemap),
  }
}
