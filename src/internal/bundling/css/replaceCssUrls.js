import postcss from "postcss"
import { urlToFileSystemPath } from "@jsenv/util"
import { postCssUrlHashPlugin } from "./postcss-urlhash-plugin.js"
import { require } from "../../require.js"

export const replaceCssUrls = async (
  css,
  cssFileUrl,
  urlReplacements,
  { cssMinification = false, cssMinificationOptions } = {},
) => {
  const result = await postcss([
    postCssUrlHashPlugin,
    ...(cssMinification ? [getCssMinificationPlugin(cssMinificationOptions)] : []),
  ]).process(css, {
    from: urlToFileSystemPath(cssFileUrl),
    to: urlToFileSystemPath(cssFileUrl),
    urlReplacements,
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
