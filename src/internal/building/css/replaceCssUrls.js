import { require } from "@jsenv/core/src/internal/require.js"
import { applyPostCss } from "./applyPostCss.js"
import { postCssPluginUrlVisitor } from "./postcss_plugin_url_visitor.js"

export const replaceCssUrls = async ({
  url,
  code,
  map,
  getUrlReplacementValue,
  cssConcatenation = false,
  cssMinification = false,
  cssMinificationOptions,
} = {}) => {
  const postcssPlugins = [
    ...(cssConcatenation ? [await getCssConcatenationPlugin()] : []),
    postCssPluginUrlVisitor,
    ...(cssMinification
      ? [await getCssMinificationPlugin(cssMinificationOptions)]
      : []),
  ]
  const postcssOptions = {
    getUrlReplacementValue,
    map: {
      inline: false,
      // https://postcss.org/api/#sourcemapoptions
      ...(map ? { prev: JSON.stringify(map) } : {}),
    },
  }
  const result = await applyPostCss(code, url, postcssPlugins, postcssOptions)

  return {
    code: result.css,
    map: result.map.toJSON(),
  }
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

const getCssConcatenationPlugin = async () => {
  const postcssImport = require("postcss-import")
  return postcssImport()
}
