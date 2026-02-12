// tslint:disable:ordered-imports

import { jsenvPluginSupervisor } from "@jsenv/plugin-supervisor";
import { jsenvPluginTranspilation } from "@jsenv/plugin-transpilation";

import { jsenvPluginReferenceAnalysis } from "./reference_analysis/jsenv_plugin_reference_analysis.js";
import { jsenvPluginNodeEsmResolution } from "./resolution_node_esm/jsenv_plugin_node_esm_resolution.js";
import { jsenvPluginWebResolution } from "./resolution_web/jsenv_plugin_web_resolution.js";
import { jsenvPluginVersionSearchParam } from "./version_search_param/jsenv_plugin_version_search_param.js";
import { jsenvPluginProtocolFile } from "./protocol_file/jsenv_plugin_protocol_file.js";
import { jsenvPluginProtocolHttp } from "./protocol_http/jsenv_plugin_protocol_http.js";
import { jsenvPluginDirectoryReferenceEffect } from "./directory_reference_effect/jsenv_plugin_directory_reference_effect.js";
import { jsenvPluginInjections } from "./injections/jsenv_plugin_injections.js";
import { jsenvPluginInlining } from "./inlining/jsenv_plugin_inlining.js";
import { jsenvPluginCommonJsGlobals } from "./commonjs_globals/jsenv_plugin_commonjs_globals.js";
import { jsenvPluginImportMetaScenarios } from "./import_meta_scenarios/jsenv_plugin_import_meta_scenarios.js";
import { jsenvPluginGlobalScenarios } from "./global_scenarios/jsenv_plugin_global_scenarios.js";
import { jsenvPluginNodeRuntime } from "./node_runtime/jsenv_plugin_node_runtime.js";
import { jsenvPluginImportMetaCss } from "./import_meta_css/jsenv_plugin_import_meta_css.js";
// autoreload
import { jsenvPluginImportMetaHot } from "./import_meta_hot/jsenv_plugin_import_meta_hot.js";
import { jsenvPluginAutoreload } from "./autoreload/jsenv_plugin_autoreload.js";
import { jsenvPluginCacheControl } from "./cache_control/jsenv_plugin_cache_control.js";
// other
import { jsenvPluginRibbon } from "./ribbon/jsenv_plugin_ribbon.js";
import { jsenvPluginDropToOpen } from "./drop_to_open/jsenv_plugin_drop_to_open.js";
import { jsenvPluginCleanHTML } from "./clean_html/jsenv_plugin_clean_html.js";
import { jsenvPluginChromeDevtoolsJson } from "./chrome_devtools_json/jsenv_plugin_chrome_devtools_json.js";
import { jsenvPluginAutoreloadOnServerRestart } from "./autoreload_on_server_restart/jsenv_plugin_autoreload_on_server_restart.js";
import { jsenvPluginPackageSideEffects } from "./package_side_effects/jsenv_plugin_package_side_effects.js";
import { jsenvPluginWorkspaceBundle } from "./workspace_bundle/jsenv_plugin_workspace_bundle.js";

export const getCorePlugins = ({
  rootDirectoryUrl,
  mainFilePath,
  runtimeCompat,
  packageDirectory,
  sourceFilesConfig,

  referenceAnalysis = {},
  nodeEsmResolution = {},
  packageConditions,
  packageConditionsConfig,
  magicExtensions,
  magicDirectoryIndex,
  directoryListing = true,
  directoryReferenceEffect,
  supervisor,
  injections,
  transpilation = true,
  inlining = true,
  http = false,
  spa,

  clientAutoreload,
  clientAutoreloadOnServerRestart,
  cacheControl,
  scenarioPlaceholders = true,
  ribbon = true,
  dropToOpen = true,
  packageSideEffects = false,
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
  if (http === true) {
    http = { include: true };
  }
  if (http === false) {
    http = { include: false };
  }
  if (directoryListing === true) {
    directoryListing = {};
  }

  return [
    jsenvPluginWorkspaceBundle(),

    jsenvPluginReferenceAnalysis(referenceAnalysis),
    jsenvPluginInjections(injections),
    jsenvPluginTranspilation(transpilation),
    // "jsenvPluginInlining" must be very soon because all other plugins will react differently once they see the file is inlined
    ...(inlining ? [jsenvPluginInlining()] : []),

    /* When resolving references the following applies by default:
       - http urls are resolved by jsenvPluginHttpUrls
       - reference.type === "filesystem" -> resolved by jsenv_plugin_file_urls.js
       - reference inside a js module -> resolved by node esm
       - All the rest uses web standard url resolution
     */
    jsenvPluginProtocolHttp(http),
    jsenvPluginProtocolFile({
      spa,
      magicExtensions,
      magicDirectoryIndex,
      directoryListing,
      rootDirectoryUrl,
      mainFilePath,
      packageDirectory,
      sourceFilesConfig,
    }),
    {
      name: "jsenv:resolve_root_as_main",
      appliesDuring: "*",
      resolveReference: (reference) => {
        const { ownerUrlInfo } = reference;
        if (reference.specifierPathname === "/") {
          const { mainFilePath, rootDirectoryUrl } = ownerUrlInfo.context;
          const url = new URL(mainFilePath, rootDirectoryUrl);
          return url;
        }
        return null;
      },
    },
    ...(nodeEsmResolution
      ? [
          jsenvPluginNodeEsmResolution({
            packageDirectory,
            resolutionConfig: nodeEsmResolution,
            packageConditions,
            packageConditionsConfig,
          }),
        ]
      : []),
    jsenvPluginWebResolution(),
    jsenvPluginDirectoryReferenceEffect(directoryReferenceEffect, {
      rootDirectoryUrl,
    }),
    jsenvPluginVersionSearchParam(),

    // "jsenvPluginSupervisor" MUST be after "jsenvPluginInlining" as it needs inline script to be cooked
    ...(supervisor ? [jsenvPluginSupervisor(supervisor)] : []),
    ...(clientAutoreloadOnServerRestart
      ? [jsenvPluginAutoreloadOnServerRestart()]
      : []),

    jsenvPluginImportMetaCss(),
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
    ...(dropToOpen ? [jsenvPluginDropToOpen()] : []),
    jsenvPluginCleanHTML(),
    jsenvPluginChromeDevtoolsJson(),
    ...(packageSideEffects
      ? [jsenvPluginPackageSideEffects({ packageDirectory })]
      : []),
  ];
};
