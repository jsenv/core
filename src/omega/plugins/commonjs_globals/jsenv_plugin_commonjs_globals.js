/*
 * Some code uses globals specific to Node.js in code meant to run in browsers...
 * This plugin will replace some node globals to things compatible with web:
 * - process.env.NODE_ENV
 * - __filename
 * - __dirname
 * - global
 */

import { applyBabelPlugins } from "@jsenv/core/src/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/core/src/utils/sourcemap/magic_source.js"

import { babelPluginMetadataExpressionPaths } from "./babel_plugin_metadata_expression_paths.js"

export const jsenvPluginCommonJsGlobals = () => {
  return {
    name: "jsenv:commonjs_globals",
    appliesDuring: "*",
    transform: {
      js_module: async ({ scenario, getOriginalUrlSite, url, content }) => {
        const replaceMap = {
          "process.env.NODE_ENV": `("${
            scenario === "dev" || scenario === "test" ? "dev" : "prod"
          }")`,
          "global": "globalThis",
          "__filename": `import.meta.url.slice('file:///'.length)`,
          "__dirname": `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`,
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [
            [
              babelPluginMetadataExpressionPaths,
              {
                replaceMap,
                allowConflictingReplacements: true,
              },
            ],
          ],
          getOriginalUrlSite,
          url,
          content,
        })
        const { expressionPaths } = metadata
        const keys = Object.keys(expressionPaths)
        if (keys.length === 0) {
          return null
        }
        const magicSource = createMagicSource({
          url,
          content,
        })
        keys.forEach((key) => {
          expressionPaths[key].forEach((path) => {
            magicSource.replace({
              start: path.node.start,
              end: path.node.end,
              replacement: replaceMap[key],
            })
          })
        })
        return magicSource.toContentAndSourcemap()
      },
    },
  }
}
