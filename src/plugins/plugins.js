import { jsenvPluginSupervisor } from "@jsenv/plugin-supervisor";
import { jsenvPluginTranspilation } from "@jsenv/plugin-transpilation";

import { jsenvPluginReferenceAnalysis } from "./reference_analysis/jsenv_plugin_reference_analysis.js";
import { jsenvPluginImportmap } from "./importmap/jsenv_plugin_importmap.js";
import { jsenvPluginNodeEsmResolution } from "./resolution_node_esm/jsenv_plugin_node_esm_resolution.js";
import { jsenvPluginWebResolution } from "./resolution_web/jsenv_plugin_web_resolution.js";
import { jsenvPluginVersionSearchParam } from "./version_search_param/jsenv_plugin_version_search_param.js";
import { jsenvPluginProtocolFile } from "./protocol_file/jsenv_plugin_protocol_file.js";
import { jsenvPluginProtocolHttp } from "./protocol_http/jsenv_plugin_protocol_http.js";
import { jsenvPluginInlining } from "./inlining/jsenv_plugin_inlining.js";
import { jsenvPluginCommonJsGlobals } from "./commonjs_globals/jsenv_plugin_commonjs_globals.js";
import { jsenvPluginImportMetaScenarios } from "./import_meta_scenarios/jsenv_plugin_import_meta_scenarios.js";
import { jsenvPluginGlobalScenarios } from "./global_scenarios/jsenv_plugin_global_scenarios.js";
import { jsenvPluginNodeRuntime } from "./node_runtime/jsenv_plugin_node_runtime.js";
// autoreload
import { jsenvPluginImportMetaHot } from "./import_meta_hot/jsenv_plugin_import_meta_hot.js";
import { jsenvPluginAutoreload } from "./autoreload/jsenv_plugin_autoreload.js";
import { jsenvPluginCacheControl } from "./cache_control/jsenv_plugin_cache_control.js";
// other
import { jsenvPluginRibbon } from "./ribbon/jsenv_plugin_ribbon.js";
import { jsenvPluginCleanHTML } from "./clean_html/jsenv_plugin_clean_html.js";

export const getCorePlugins = ({
  rootDirectoryUrl,
  runtimeCompat,

  referenceAnalysis = {},
  nodeEsmResolution = {},
  magicExtensions,
  magicDirectoryIndex,
  directoryReferenceAllowed,
  supervisor,
  transpilation = true,
  inlining = true,

  clientAutoreload,
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
  if (ribbon === true) {
    ribbon = {};
  }

  return [
    jsenvPluginReferenceAnalysis(referenceAnalysis),
    jsenvPluginTranspilation(transpilation),
    jsenvPluginImportmap(),
    ...(inlining ? [jsenvPluginInlining()] : []),
    ...(supervisor ? [jsenvPluginSupervisor(supervisor)] : []), // after inline as it needs inline script to be cooked

    /* When resolving references the following applies by default:
       - http urls are resolved by jsenvPluginHttpUrls
       - reference.type === "filesystem" -> resolved by jsenv_plugin_file_urls.js
       - reference inside a js module -> resolved by node esm
       - All the rest uses web standard url resolution
     */
    jsenvPluginProtocolFile({
      directoryReferenceAllowed,
      magicExtensions,
      magicDirectoryIndex,
    }),
    jsenvPluginProtocolHttp(),
    ...(nodeEsmResolution
      ? [jsenvPluginNodeEsmResolution(nodeEsmResolution)]
      : []),
    jsenvPluginWebResolution(),

    jsenvPluginVersionSearchParam(),
    jsenvPluginCommonJsGlobals(),
    jsenvPluginImportMetaScenarios(),
    ...(scenarioPlaceholders ? [jsenvPluginGlobalScenarios()] : []),

    jsenvPluginNodeRuntime({ runtimeCompat }),

    jsenvPluginImportMetaHot(),
    ...(clientAutoreload && clientAutoreload.enabled
      ? [jsenvPluginAutoreload(clientAutoreload)]
      : []),
    ...(cacheControl ? [jsenvPluginCacheControl(cacheControl)] : []),
    ...(ribbon ? [jsenvPluginRibbon({ rootDirectoryUrl, ...ribbon })] : []),
    jsenvPluginCleanHTML(),
  ];
};
