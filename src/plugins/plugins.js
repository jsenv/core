import { jsenvPluginUrlAnalysis } from "./url_analysis/jsenv_plugin_url_analysis.js";
import { jsenvPluginImportmap } from "./importmap/jsenv_plugin_importmap.js";
import { jsenvPluginNodeEsmResolution } from "./resolution_node_esm/jsenv_plugin_node_esm_resolution.js";
import { jsenvPluginWebResolution } from "./resolution_web/jsenv_plugin_web_resolution.js";
import { jsenvPluginVersionSearchParam } from "./version_search_param/jsenv_plugin_version_search_param.js";
import { jsenvPluginFileUrls } from "./file_urls/jsenv_plugin_file_urls.js";
import { jsenvPluginHttpUrls } from "./http_urls/jsenv_plugin_http_urls.js";
import { jsenvPluginInlineContentAnalysis } from "./inline_content_analysis/jsenv_plugin_inline_content_analysis.js";
import { jsenvPluginInlining } from "./inlining/jsenv_plugin_inlining.js";
import { jsenvPluginSupervisor } from "./supervisor/jsenv_plugin_supervisor.js";
import { jsenvPluginCommonJsGlobals } from "./commonjs_globals/jsenv_plugin_commonjs_globals.js";
import { jsenvPluginImportMetaScenarios } from "./import_meta_scenarios/jsenv_plugin_import_meta_scenarios.js";
import { jsenvPluginGlobalScenarios } from "./global_scenarios/jsenv_plugin_global_scenarios.js";
import { jsenvPluginTranspilation } from "./transpilation/jsenv_plugin_transpilation.js";
import { jsenvPluginNodeRuntime } from "./node_runtime/jsenv_plugin_node_runtime.js";
// autoreload
import { jsenvPluginImportMetaHot } from "./import_meta_hot/jsenv_plugin_import_meta_hot.js";
import { jsenvPluginAutoreload } from "./autoreload/jsenv_plugin_autoreload.js";
import { jsenvPluginCacheControl } from "./cache_control/jsenv_plugin_cache_control.js";
// other
import { jsenvPluginRibbon } from "./ribbon/jsenv_plugin_ribbon.js";

export const getCorePlugins = ({
  rootDirectoryUrl,
  runtimeCompat,

  nodeEsmResolution = {},
  webResolution = {},
  urlAnalysis = {},
  fileSystemMagicRedirection,
  directoryReferenceAllowed,
  supervisor,
  transpilation = true,
  inlining = true,

  clientAutoreload = false,
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList,
  cacheControl,
  scenarioPlaceholders = true,
  ribbon = true,
} = {}) => {
  if (cacheControl === true) {
    cacheControl = {};
  }
  if (supervisor === true) {
    supervisor = {};
  }
  if (fileSystemMagicRedirection === true) {
    fileSystemMagicRedirection = {};
  }
  if (clientAutoreload === true) {
    clientAutoreload = {};
  }
  if (ribbon === true) {
    ribbon = {};
  }

  return [
    jsenvPluginUrlAnalysis({ rootDirectoryUrl, ...urlAnalysis }),
    jsenvPluginTranspilation(transpilation),
    jsenvPluginImportmap(),
    // before node esm to handle bare specifiers
    // + before node esm to handle importmap before inline content
    jsenvPluginInlineContentAnalysis(), // before "file urls" to resolve and load inline urls
    ...(inlining ? [jsenvPluginInlining()] : []),
    ...(supervisor ? [jsenvPluginSupervisor(supervisor)] : []), // after inline as it needs inline script to be cooked

    /* When resolving references the following applies by default:
       - http urls are resolved by jsenvPluginHttpUrls
       - reference.type === "filesystem" -> resolved by jsenv_plugin_file_urls.js
       - reference inside a js module -> resolved by node esm
       - All the rest uses web standard url resolution
     */
    jsenvPluginFileUrls({
      directoryReferenceAllowed,
      ...fileSystemMagicRedirection,
    }),
    jsenvPluginHttpUrls(),
    ...(nodeEsmResolution
      ? [jsenvPluginNodeEsmResolution(nodeEsmResolution)]
      : []),
    jsenvPluginWebResolution(webResolution),

    jsenvPluginVersionSearchParam(),
    jsenvPluginCommonJsGlobals(),
    jsenvPluginImportMetaScenarios(),
    ...(scenarioPlaceholders ? [jsenvPluginGlobalScenarios()] : []),

    jsenvPluginNodeRuntime({ runtimeCompat }),

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
    ...(cacheControl ? [jsenvPluginCacheControl(cacheControl)] : []),
    ...(ribbon ? [jsenvPluginRibbon({ rootDirectoryUrl, ...ribbon })] : []),
  ];
};
