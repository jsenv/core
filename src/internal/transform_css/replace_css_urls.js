import {
  assertAndNormalizeDirectoryUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"

import { applyPostCss } from "./apply_post_css.js"
import { postCssPluginUrlVisitor } from "./postcss_plugin_url_visitor.js"

export const replaceCssUrls = async ({
  url,
  urlVisitor,
  map,
  code,
  cssConcatenation = false,
  cssConcatenationLoadImport,
  cssMinification = false,
  cssMinificationOptions,
} = {}) => {
  const result = await applyPostCss({
    code,
    url,
    plugins: [
      postCssPluginUrlVisitor({ urlVisitor }),
      ...(cssConcatenation
        ? [await getCssConcatenationPlugin({ url, cssConcatenationLoadImport })]
        : []),
      ...(cssMinification
        ? [await getCssMinificationPlugin(cssMinificationOptions)]
        : []),
    ],
  })
  code = result.code
  map = result.map
  return {
    code,
    map,
  }
}

const getCssConcatenationPlugin = async ({ cssConcatenationLoadImport }) => {
  const postcssImport = require("postcss-import")
  return postcssImport({
    resolve: (id, basedir) => {
      const url = new URL(id, assertAndNormalizeDirectoryUrl(basedir)).href
      return urlToFileSystemPath(url)
    },
    load: (id) => {
      return cssConcatenationLoadImport(id)
    },
  })
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
