import { require } from "@jsenv/core/src/internal/require.js"
import { applyPostCss } from "./applyPostCss.js"
import { postCssPluginUrlVisitor } from "./postcss_plugin_url_visitor.js"

export const replaceCssUrls = async ({
  url,
  code,
  getUrlReplacementValue,
  cssMinification = false,
  cssMinificationOptions,
  sourcemapOptions = {},
} = {}) => {
  const postcssPlugins = [
    postCssPluginUrlVisitor,
    ...(cssMinification
      ? [await getCssMinificationPlugin(cssMinificationOptions)]
      : []),
  ]
  const postcssOptions = {
    getUrlReplacementValue,
    map: {
      inline: false,
      ...sourcemapOptions,
    },
  }
  const result = await applyPostCss(code, url, postcssPlugins, postcssOptions)
  return result
}

const getCssMinificationPlugin = async (cssMinificationOptions = {}) => {
  const cssnano = require("cssnano")
  const cssnanoDefaultPreset = require("cssnano-preset-default")
  return cssnano({
    preset: cssnanoDefaultPreset({
      ...cssMinificationOptions,
      // just to show how you could configure dicard comment plugin from css nano
      // https://github.com/cssnano/cssnano/tree/master/packages/cssnano-preset-default
      // discardComments: {
      //   remove: () => false,
      // },
    }),
  })
}
