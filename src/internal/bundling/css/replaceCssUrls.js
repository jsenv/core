import { urlToFileSystemPath } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"
import { postCssUrlHashPlugin } from "./postcss-urlhash-plugin.js"

const postcss = require("postcss")

export const replaceCssUrls = async (
  css,
  cssFileUrl,
  getUrlReplacementValue,
  { cssMinification = false, cssMinificationOptions } = {},
) => {
  const result = await postcss([
    postCssUrlHashPlugin,
    ...(cssMinification ? [getCssMinificationPlugin(cssMinificationOptions)] : []),
  ]).process(css, {
    from: urlToFileSystemPath(cssFileUrl),
    to: urlToFileSystemPath(cssFileUrl),
    getUrlReplacementValue,
    map: {
      inline: false,
    },
  })
  return result
}

const getCssMinificationPlugin = (cssMinificationOptions = {}) => {
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
