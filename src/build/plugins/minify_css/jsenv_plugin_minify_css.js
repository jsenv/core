import { createRequire } from "node:module"

import { applyPostCss } from "@jsenv/core/packages/utils/css_ast/apply_post_css.js"

const require = createRequire(import.meta.url)

export const jsenvPluginMinifyCss = (options = {}) => {
  return {
    name: "jsenv:minify_css",
    appliesDuring: {
      build: true,
    },
    optimize: {
      css: async (urlInfo) => {
        const cssnano = require("cssnano")
        const cssnanoDefaultPreset = require("cssnano-preset-default")
        const result = await applyPostCss({
          sourcemaps: false,
          plugins: [
            cssnano({
              preset: cssnanoDefaultPreset({
                ...options,
                // just to show how you could configure dicard comment plugin from css nano
                // https://github.com/cssnano/cssnano/tree/master/packages/cssnano-preset-default
                // discardComments: {
                //   remove: () => false,
                // },
              }),
            }),
          ],
          url: urlInfo.data.rawUrl || urlInfo.url,
          content: urlInfo.content,
        })
        return {
          content: result.content,
          sourcemap: result.map,
        }
      },
    },
  }
}
