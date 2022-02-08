import { transformWithBabel } from "@jsenv/core/src/internal/transform_js/transform_with_babel.js"
import { scanJs } from "@jsenv/core/src/internal/hmr/scan_js.js"

import { babelPluginSyntaxes } from "./babel_plugin_syntaxes.js"
import { babelPluginMetadataUrlMentions } from "./babel_plugin_metadata_url_mentions.js"

export const modifyJs = async ({
  projectDirectoryUrl,
  ressourceGraph,
  url,
  content,
}) => {
  const transformResult = await transformWithBabel({
    projectDirectoryUrl,
    babelPluginMap: {
      "syntaxes": [babelPluginSyntaxes],
      "metadata-url-mentions": [babelPluginMetadataUrlMentions],
    },
    moduleOutFormat: "esmodule",
    importMetaFormat: "esmodule",
    importMetaHot: true,
    sourcemapEnabled: false,
    url,
    content,
  })
  const { metadata } = transformResult
  js = transformResult.content
  scanJs({
    ressourceGraph,
    url,
    metadata,
  })
  return {
    content,
  }
}
