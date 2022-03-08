import { jsenvPluginImportmap } from "@jsenv/core/src/omega/plugins/importmap/jsenv_plugin_importmap.js"
import { jsenvPluginUrlResolution } from "@jsenv/core/src/omega/plugins/url_resolution/jsenv_plugin_url_resolution.js"
import { jsenvPluginNodeEsmResolution } from "@jsenv/core/src/omega/plugins/node_esm_resolution/jsenv_plugin_node_esm_resolution.js"
import { jsenvPluginDataUrls } from "@jsenv/core/src/omega/plugins/data_urls/jsenv_plugin_data_urls.js"
import { jsenvPluginFileUrls } from "@jsenv/core/src/omega/plugins/file_urls/jsenv_plugin_file_urls.js"
import { jsenvPluginFileSystemMagic } from "@jsenv/core/src/omega/plugins/filesystem_magic/jsenv_plugin_filesystem_magic.js"
import { jsenvPluginInlineRessources } from "@jsenv/core/src/omega/plugins/inline_ressources/jsenv_plugin_inline_ressources.js"
import { jsenvPluginAutoreload } from "@jsenv/core/src/omega/plugins/autoreload/jsenv_plugin_autoreload.js"
import { jsenvPluginHtmlSupervisor } from "@jsenv/core/src/omega/plugins/html_supervisor/jsenv_plugin_html_supervisor.js"
import { jsenvPluginCommonJsGlobals } from "@jsenv/core/src/omega/plugins/commonjs_globals/jsenv_plugin_commonjs_globals.js"
import { jsenvPluginBabel } from "@jsenv/core/src/omega/plugins/babel/jsenv_plugin_babel.js"

export const getJsenvPlugins = () => {
  const asFewAsPossible = false // useful during dev
  return [
    // "inline ressources" must come before "filesystem magic"
    // otherwise it will try to read inline files
    ...(asFewAsPossible ? [] : [jsenvPluginInlineRessources()]),
    ...(asFewAsPossible ? [] : [jsenvPluginFileSystemMagic()]),
    jsenvPluginImportmap(), // must come before node esm to catch "js_import_export"
    jsenvPluginNodeEsmResolution(), // must come before url resolution to catch "js_import_export"
    jsenvPluginUrlResolution(),
    // load
    jsenvPluginDataUrls(),
    jsenvPluginFileUrls(),
    // transform
    ...(asFewAsPossible ? [] : [jsenvPluginAutoreload()]),
    ...(asFewAsPossible ? [] : [jsenvPluginHtmlSupervisor()]),
    ...(asFewAsPossible ? [] : [jsenvPluginCommonJsGlobals()]),
    jsenvPluginBabel(),
  ]
}
