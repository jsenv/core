import { jsenvPluginLeadingSlash } from "@jsenv/core/src/omega/plugins/leading_slash/jsenv_plugin_leading_slash.js"
import { jsenvPluginImportmap } from "@jsenv/core/src/omega/plugins/importmap/jsenv_plugin_importmap.js"
import { jsenvPluginUrlResolution } from "@jsenv/core/src/omega/plugins/url_resolution/jsenv_plugin_url_resolution.js"
import { jsenvPluginNodeEsmResolution } from "@jsenv/core/src/omega/plugins/node_esm_resolution/jsenv_plugin_node_esm_resolution.js"
import { jsenvPluginUrlVersion } from "@jsenv/core/src/omega/plugins/url_version/jsenv_plugin_url_version.js"
import { jsenvPluginFileUrls } from "@jsenv/core/src/omega/plugins/file_urls/jsenv_plugin_file_urls.js"
import { jsenvPluginFileSystemMagic } from "@jsenv/core/src/omega/plugins/filesystem_magic/jsenv_plugin_filesystem_magic.js"
import { jsenvPluginInline } from "@jsenv/core/src/omega/plugins/inline/jsenv_plugin_inline.js"
import { jsenvPluginHtmlSupervisor } from "@jsenv/core/src/omega/plugins/html_supervisor/jsenv_plugin_html_supervisor.js"
import { jsenvPluginCommonJsGlobals } from "@jsenv/core/src/omega/plugins/commonjs_globals/jsenv_plugin_commonjs_globals.js"
import { jsenvPluginImportAssertions } from "@jsenv/core/src/omega/plugins/import_assertions/jsenv_plugin_import_assertions.js"
import { jsenvPluginImportMetaScenarios } from "@jsenv/core/src/omega/plugins/import_meta_scenarios/jsenv_plugin_import_meta_scenarios.js"
import { jsenvPluginBabel } from "@jsenv/core/src/omega/plugins/babel/jsenv_plugin_babel.js"

export const getJsenvPlugins = ({
  htmlSupervisor,
  nodeEsmResolution,
  fileSystemMagicResolution,
  babel,
} = {}) => {
  const asFewAsPossible = false // useful during dev
  return [
    ...(asFewAsPossible ? [] : [jsenvPluginImportAssertions()]),
    ...(asFewAsPossible ? [] : [jsenvPluginHtmlSupervisor(htmlSupervisor)]), // before inline as it turns inline <script> into <script src>
    ...(asFewAsPossible ? [] : [jsenvPluginInline()]), // must come first to resolve inline urls
    jsenvPluginFileUrls(),
    jsenvPluginLeadingSlash(),
    jsenvPluginImportmap(), // must come before node esm to handle bare specifiers before node esm
    jsenvPluginNodeEsmResolution(nodeEsmResolution), // must come before url resolution to handle "js_import_export" resolution
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
