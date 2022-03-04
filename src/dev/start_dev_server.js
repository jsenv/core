import { startOmegaServer } from "@jsenv/core/src/omega/server.js"

import { jsenvPluginImportmap } from "@jsenv/core/src/omega/plugins/importmap/jsenv_plugin_importmap.js"
import { jsenvPluginUrlResolution } from "@jsenv/core/src/omega/plugins/url_resolution/jsenv_plugin_url_resolution.js"
import { jsenvPluginNodeEsmResolution } from "@jsenv/core/src/omega/plugins/node_esm_resolution/jsenv_plugin_node_esm_resolution.js"
import { jsenvPluginDataUrls } from "@jsenv/core/src/omega/plugins/data_urls/jsenv_plugin_data_urls.js"
import { jsenvPluginFileUrls } from "@jsenv/core/src/omega/plugins/file_urls/jsenv_plugin_file_urls.js"
import { jsenvPluginFileSystemMagicResolution } from "@jsenv/core/src/omega/plugins/filesystem_magic_resolution/jsenv_plugin_filesystem_magic_resolution.js"
import { jsenvPluginInlineRessources } from "@jsenv/core/src/omega/plugins/inline_ressources/jsenv_plugin_inline_ressources.js"
import { jsenvPluginAutoreload } from "@jsenv/core/src/omega/plugins/autoreload/jsenv_plugin_autoreload.js"
import { jsenvPluginHtmlSupervisor } from "@jsenv/core/src/omega/plugins/html_supervisor/jsenv_plugin_html_supervisor.js"
import { jsenvPluginCommonJsGlobals } from "@jsenv/core/src/omega/plugins/commonjs_globals/jsenv_plugin_commonjs_globals.js"
import { jsenvPluginBabel } from "@jsenv/core/src/omega/plugins/babel/jsenv_plugin_babel.js"

export const startDevServer = async ({
  port,
  protocol,
  certificate,
  privateKey,

  projectDirectoryUrl,
  plugins = [],
}) => {
  const server = await startOmegaServer({
    keepProcessAlive: true,
    port,
    protocol,
    certificate,
    privateKey,
    projectDirectoryUrl,
    plugins: [
      ...plugins,
      // resolve
      // "inline ressources" must come before "filesystem magic resolution"
      // otherwise it will try to read inline files
      jsenvPluginInlineRessources(),
      jsenvPluginFileSystemMagicResolution(),
      jsenvPluginUrlResolution(),
      jsenvPluginImportmap(),
      jsenvPluginNodeEsmResolution(),
      // load
      jsenvPluginDataUrls(),
      jsenvPluginFileUrls(),
      // transform
      jsenvPluginAutoreload(),
      jsenvPluginHtmlSupervisor(),
      jsenvPluginCommonJsGlobals(),
      jsenvPluginBabel(),
    ],
    scenario: "dev",
  })
  return server
}
