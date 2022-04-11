import { jsenvPluginLeadingSlash } from "./core_plugins/leading_slash/jsenv_plugin_leading_slash.js"
import { jsenvPluginImportmap } from "./core_plugins/importmap/jsenv_plugin_importmap.js"
import { jsenvPluginUrlResolution } from "./core_plugins/url_resolution/jsenv_plugin_url_resolution.js"
import { jsenvPluginNodeEsmResolution } from "./core_plugins/node_esm_resolution/jsenv_plugin_node_esm_resolution.js"
import { jsenvPluginUrlVersion } from "./core_plugins/url_version/jsenv_plugin_url_version.js"
import { jsenvPluginFileUrls } from "./core_plugins/file_urls/jsenv_plugin_file_urls.js"
import { jsenvPluginFileSystemMagic } from "./core_plugins/filesystem_magic/jsenv_plugin_filesystem_magic.js"
import { jsenvPluginInline } from "./core_plugins/inline/jsenv_plugin_inline.js"
import { jsenvPluginHtmlSupervisor } from "./core_plugins/html_supervisor/jsenv_plugin_html_supervisor.js"
import { jsenvPluginCommonJsGlobals } from "./core_plugins/commonjs_globals/jsenv_plugin_commonjs_globals.js"
import { jsenvPluginImportAssertions } from "./core_plugins/import_assertions/jsenv_plugin_import_assertions.js"
import { jsenvPluginImportMetaScenarios } from "./core_plugins/import_meta_scenarios/jsenv_plugin_import_meta_scenarios.js"
import { jsenvPluginBabel } from "./core_plugins/babel/jsenv_plugin_babel.js"

export const getCorePlugins = ({
  htmlSupervisor,
  nodeEsmResolution,
  fileSystemMagicResolution,
  babel,
} = {}) => {
  const asFewAsPossible = false // useful during dev
  return [
    ...(asFewAsPossible ? [] : [jsenvPluginImportAssertions()]),
    ...(asFewAsPossible ? [] : [jsenvPluginHtmlSupervisor(htmlSupervisor)]), // before inline as it turns inline <script> into <script src>
    ...(asFewAsPossible ? [] : [jsenvPluginInline()]), // before "file urls" to resolve and load inline urls
    jsenvPluginImportmap(), // before node esm to handle bare specifiers before node esm
    jsenvPluginFileUrls(),
    jsenvPluginLeadingSlash(),
    jsenvPluginNodeEsmResolution(nodeEsmResolution), // before url resolution to handle "js_import_export" resolution
    jsenvPluginUrlResolution(),
    ...(asFewAsPossible
      ? []
      : [jsenvPluginFileSystemMagic(fileSystemMagicResolution)]),
    jsenvPluginUrlVersion(),
    ...(asFewAsPossible ? [] : [jsenvPluginCommonJsGlobals()]),
    ...(asFewAsPossible ? [] : [jsenvPluginImportMetaScenarios()]),
    jsenvPluginBabel(babel),
  ]
}
