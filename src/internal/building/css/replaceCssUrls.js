import { require } from "@jsenv/core/src/internal/require.js"
import { applyPostCss } from "./applyPostCss.js"
import { postCssUrlHashPlugin } from "./postcss-urlhash-plugin.js"

export const replaceCssUrls = async (
  css,
  cssUrl,
  getUrlReplacementValue,
  { cssMinification = false, cssMinificationOptions, sourcemapOptions = {} } = {},
) => {
  const postcssPlugins = [
    postCssUrlHashPlugin,
    ...(cssMinification ? [await getCssMinificationPlugin(cssMinificationOptions)] : []),
  ]
  const postcssOptions = {
    getUrlReplacementValue,
    map: {
      inline: false,
      ...sourcemapOptions,
    },
  }
  const result = await applyPostCss(css, cssUrl, postcssPlugins, postcssOptions)
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
