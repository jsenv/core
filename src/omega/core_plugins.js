import { corePluginLeadingSlash } from "@jsenv/core/src/omega/plugins/leading_slash/core_plugin_leading_slash.js"
import { corePluginImportmap } from "@jsenv/core/src/omega/plugins/importmap/core_plugin_importmap.js"
import { corePluginUrlResolution } from "@jsenv/core/src/omega/plugins/url_resolution/core_plugin_url_resolution.js"
import { corePluginNodeEsmResolution } from "@jsenv/core/src/omega/plugins/node_esm_resolution/core_plugin_node_esm_resolution.js"
import { corePluginUrlVersion } from "@jsenv/core/src/omega/plugins/url_version/core_plugin_url_version.js"
import { corePluginFileUrls } from "@jsenv/core/src/omega/plugins/file_urls/core_plugin_file_urls.js"
import { corePluginFileSystemMagic } from "@jsenv/core/src/omega/plugins/filesystem_magic/core_plugin_filesystem_magic.js"
import { corePluginInline } from "@jsenv/core/src/omega/plugins/inline/core_plugin_inline.js"
import { corePluginHtmlSupervisor } from "@jsenv/core/src/omega/plugins/html_supervisor/core_plugin_html_supervisor.js"
import { corePluginCommonJsGlobals } from "@jsenv/core/src/omega/plugins/commonjs_globals/core_plugin_commonjs_globals.js"
import { corePluginImportAssertions } from "@jsenv/core/src/omega/plugins/import_assertions/core_plugin_import_assertions.js"
import { corePluginImportMetaScenarios } from "@jsenv/core/src/omega/plugins/import_meta_scenarios/core_plugin_import_meta_scenarios.js"
import { corePluginBabel } from "@jsenv/core/src/omega/plugins/babel/core_plugin_babel.js"

export const getCorePlugins = ({
  htmlSupervisor,
  nodeEsmResolution,
  fileSystemMagicResolution,
  babel,
} = {}) => {
  const asFewAsPossible = false // useful during dev
  return [
    ...(asFewAsPossible ? [] : [corePluginImportAssertions()]),
    ...(asFewAsPossible ? [] : [corePluginHtmlSupervisor(htmlSupervisor)]), // before inline as it turns inline <script> into <script src>
    ...(asFewAsPossible ? [] : [corePluginInline()]), // must come first to resolve inline urls
    corePluginFileUrls(),
    corePluginLeadingSlash(),
    corePluginImportmap(), // must come before node esm to handle bare specifiers before node esm
    corePluginNodeEsmResolution(nodeEsmResolution), // must come before url resolution to handle "js_import_export" resolution
    corePluginUrlResolution(),
    ...(asFewAsPossible
      ? []
      : [corePluginFileSystemMagic(fileSystemMagicResolution)]),
    corePluginUrlVersion(),
    ...(asFewAsPossible ? [] : [corePluginCommonJsGlobals()]),
    ...(asFewAsPossible ? [] : [corePluginImportMetaScenarios()]),
    corePluginBabel(babel),
  ]
}
