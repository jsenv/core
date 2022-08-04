import { jsenvPluginUrlAnalysis } from "../plugins/url_analysis/jsenv_plugin_url_analysis.js"
import { jsenvPluginLeadingSlash } from "./leading_slash/jsenv_plugin_leading_slash.js"
import { jsenvPluginImportmap } from "./importmap/jsenv_plugin_importmap.js"
import { jsenvPluginUrlResolution } from "./url_resolution/jsenv_plugin_url_resolution.js"
import { jsenvPluginNodeEsmResolution } from "./node_esm_resolution/jsenv_plugin_node_esm_resolution.js"
import { jsenvPluginUrlVersion } from "./url_version/jsenv_plugin_url_version.js"
import { jsenvPluginFileUrls } from "./file_urls/jsenv_plugin_file_urls.js"
import { jsenvPluginHttpUrls } from "./http_urls/jsenv_plugin_http_urls.js"
import { jsenvPluginInline } from "./inline/jsenv_plugin_inline.js"
import { jsenvPluginSupervisor } from "./supervisor/jsenv_plugin_supervisor.js"
import { jsenvPluginCommonJsGlobals } from "./commonjs_globals/jsenv_plugin_commonjs_globals.js"
import { jsenvPluginImportMetaScenarios } from "./import_meta_scenarios/jsenv_plugin_import_meta_scenarios.js"
import { jsenvPluginTranspilation } from "./transpilation/jsenv_plugin_transpilation.js"
import { jsenvPluginNodeRuntime } from "./node_runtime/jsenv_plugin_node_runtime.js"
// build only
import { jsenvPluginBundling } from "./bundling/jsenv_plugin_bundling.js"
import { jsenvPluginMinification } from "./minification/jsenv_plugin_minification.js"
// autoreload
import { jsenvPluginImportMetaHot } from "./import_meta_hot/jsenv_plugin_import_meta_hot.js"
import { jsenvPluginAutoreload } from "./autoreload/jsenv_plugin_autoreload.js"
import { jsenvPluginCacheControl } from "./cache_control/jsenv_plugin_cache_control.js"
// dev only
import { jsenvPluginExplorer } from "./explorer/jsenv_plugin_explorer.js"

export const getCorePlugins = ({
  rootDirectoryUrl,
  runtimeCompat,

  urlAnalysis = {},
  supervisor,
  nodeEsmResolution = true,
  fileSystemMagicResolution,
  directoryReferenceAllowed,
  transpilation = true,
  minification = false,
  bundling = false,

  clientAutoreload = false,
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList,
  explorer,
} = {}) => {
  if (supervisor === true) {
    supervisor = {}
  }
  if (nodeEsmResolution === true) {
    nodeEsmResolution = {}
  }
  if (fileSystemMagicResolution === true) {
    fileSystemMagicResolution = {}
  }
  if (clientAutoreload === true) {
    clientAutoreload = {}
  }

  return [
    jsenvPluginUrlAnalysis({ rootDirectoryUrl, ...urlAnalysis }),
    jsenvPluginTranspilation(transpilation),
    ...(supervisor ? [jsenvPluginSupervisor(supervisor)] : []), // before inline as it turns inline <script> into <script src>
    jsenvPluginImportmap(),
    // before node esm to handle bare specifiers
    // + before node esm to handle importmap before inline content
    jsenvPluginInline(), // before "file urls" to resolve and load inline urls
    jsenvPluginFileUrls({
      directoryReferenceAllowed,
      ...fileSystemMagicResolution,
    }),
    jsenvPluginHttpUrls(),
    jsenvPluginLeadingSlash(),
    // before url resolution to handle "js_import_export" resolution
    jsenvPluginNodeEsmResolution(nodeEsmResolution),
    jsenvPluginUrlResolution(),
    jsenvPluginUrlVersion(),
    jsenvPluginCommonJsGlobals(),
    jsenvPluginImportMetaScenarios(),

    jsenvPluginNodeRuntime({ runtimeCompat }),
    jsenvPluginBundling(bundling),
    jsenvPluginMinification(minification),

    jsenvPluginImportMetaHot(),
    ...(clientAutoreload
      ? [
          jsenvPluginAutoreload({
            ...clientAutoreload,
            clientFileChangeCallbackList,
            clientFilesPruneCallbackList,
          }),
        ]
      : []),
    jsenvPluginCacheControl(),
    ...(explorer ? [jsenvPluginExplorer(explorer)] : []),
  ]
}
