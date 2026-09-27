import { build } from "@jsenv/core/src/build/build.js";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

const clientRuntimeCompat = {
  chrome: "89",
};

await build({
  sourceDirectoryUrl: import.meta.resolve("../../"),
  buildDirectoryUrl: import.meta.resolve("../../dist/"),
  outDirectoryUrl: import.meta.resolve("./.jsenv/"), // for debug
  entryPoints: {
    "./src/main.js": {
      buildRelativeUrl: "./jsenv_core.js",
      runtimeCompat: { node: "20.0" },
      scenarioPlaceholders: false,
      plugins: [
        jsenvPluginCommonJs({
          include: {
            "file:///**/node_modules/ws/": true,
            "file:///**/node_modules/@babel/parser/": true,
            "file:///**/node_modules/postcss/": true,
            "file:///**/node_modules/rollup/dist/native.js": true,
            "file:///**/node_modules/browserslist/": true,
          },
        }),
      ],
      packageConditions: {
        development: {
          "@jsenv/server/": false,
        },
      },
      packageDependencies: {
        "@jsenv/plugin-transpilation": "ignore",
      },
      directoryReferenceEffect: {
        // @jsenv/core root dir
        [import.meta.resolve("../../")]: "resolve",
        "file://**/babel_helpers/": "copy",
        "**/*": "error",
      },
    },
    // Files running in the browser, reached from the node code above through
    // new URL() or import.meta.resolve. Left out of this list, they would be
    // built along the node entry, for node.
    "./src/kitchen/client/inline_content.js": {
      buildRelativeUrl: "./client/inline_content/inline_content.js",
      runtimeCompat: clientRuntimeCompat,
    },
    "./src/plugins/autoreload/client/autoreload.js": {
      buildRelativeUrl: "./client/autoreload/autoreload.js",
      runtimeCompat: clientRuntimeCompat,
    },
    "./src/plugins/html_syntax_error_fallback/client/html_syntax_error.html": {
      buildRelativeUrl: "./client/html_syntax_error/html_syntax_error.html",
      runtimeCompat: clientRuntimeCompat,
    },
    "./src/plugins/drop_to_open/client/drop_to_open.js": {
      buildRelativeUrl: "./client/drop_to_open/drop_to_open.js",
      runtimeCompat: clientRuntimeCompat,
    },
    "./src/plugins/import_meta_css/client/import_meta_css_dev.js": {
      buildRelativeUrl: "./client/import_meta_css/import_meta_css_dev.js",
      runtimeCompat: clientRuntimeCompat,
    },
    "./src/plugins/import_meta_css/client/import_meta_css_build.js": {
      buildRelativeUrl: "./client/import_meta_css/import_meta_css_build.js",
      runtimeCompat: clientRuntimeCompat,
    },
    "./src/plugins/import_meta_hot/client/import_meta_hot.js": {
      buildRelativeUrl: "./client/import_meta_hot/import_meta_hot.js",
      runtimeCompat: clientRuntimeCompat,
    },
    "./src/plugins/protocol_file/client/directory_listing.html": {
      buildRelativeUrl: "./client/directory_listing/directory_listing.html",
      runtimeCompat: clientRuntimeCompat,
      plugins: [jsenvPluginPreact({})],
    },
    "./src/plugins/client_monitoring/client/clients_page.html": {
      buildRelativeUrl: "./client/client_monitoring/clients_page.html",
      runtimeCompat: clientRuntimeCompat,
    },
    "./src/plugins/client_monitoring/client/client_monitor_page.html": {
      buildRelativeUrl: "./client/client_monitoring/client_monitor_page.html",
      runtimeCompat: clientRuntimeCompat,
    },
    "./src/dev/dev_server_plugins/client/https_trust.html": {
      buildRelativeUrl: "./client/https_trust/https_trust.html",
      runtimeCompat: clientRuntimeCompat,
    },
    "./src/plugins/ribbon/client/ribbon.js": {
      buildRelativeUrl: "./client/ribbon/ribbon.js",
      runtimeCompat: clientRuntimeCompat,
    },
    "./src/plugins/server_events/client/server_events_client.js": {
      buildRelativeUrl: "./client/server_events/server_events_client.js",
      runtimeCompat: clientRuntimeCompat,
    },
    "./packages/internal/plugin-transpilation/src/babel/new_stylesheet/client/new_stylesheet.js":
      {
        buildRelativeUrl: "./client/new_stylesheet/new_stylesheet.js",
        runtimeCompat: clientRuntimeCompat,
      },
    "./packages/internal/plugin-transpilation/src/babel/regenerator_runtime/client/regenerator_runtime.js":
      {
        buildRelativeUrl: "./client/regenerator_runtime/regenerator_runtime.js",
        runtimeCompat: clientRuntimeCompat,
      },
    "./packages/frontend/custom-elements-redefine/src/main.js": {
      buildRelativeUrl:
        "./client/custom_elements_redefine/custom_elements_redefine.js",
      runtimeCompat: clientRuntimeCompat,
    },
  },
});
