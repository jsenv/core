import { scanJs } from "@jsenv/core/src/internal/hmr/scan_js.js"

import { babelPluginSyntaxes } from "./babel_plugin_syntaxes.js"
import { babelPluginMetadataUrlMentions } from "./babel_plugin_metadata_url_mentions.js"
import { transformJs } from "./js_transformer.js"

export const modifyJs = async ({
  projectDirectoryUrl,
  ressourceGraph,
  url,
  js,
}) => {
  const { code, metadata } = await transformJs({
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
    code: js,
  })
  scanJs({
    ressourceGraph,
    url,
    metadata,
  })
  return {
    content: code,
  }
}
