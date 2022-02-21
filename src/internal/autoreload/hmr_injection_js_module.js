import { urlToFileSystemPath, urlToRelativeUrl } from "@jsenv/filesystem"

import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"
import { babelPluginSyntaxes } from "@jsenv/core/src/internal/compile_server/js/babel_plugin_syntaxes.js"

import { babelPluginHmrEsm } from "./babel_plugin_hmr_esm.js"

export const injectHmrInJsModuleUrls = async ({
  projectDirectoryUrl,
  sourceFileFetcher,
  ressourceGraph,
  url,
  content,
}) => {
  const result = await babelTransform({
    sourceFileFetcher,
    options: {
      filename: urlToFileSystemPath(url),
      filenameRelative: urlToRelativeUrl(url, projectDirectoryUrl),
      configFile: false,
      babelrc: false, // trust only these options, do not read any babelrc config file
      sourceMaps: false,
      parserOpts: {
        allowAwaitOutsideFunction: true,
      },
      generatorOpts: {
        compact: false,
      },
      plugins: [[babelPluginSyntaxes], [babelPluginHmrEsm, { ressourceGraph }]],
    },
    url,
    code: content,
  })
  return {
    code: result.code,
    map: result.map,
  }
}
