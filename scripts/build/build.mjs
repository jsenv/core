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
          },
        }),
      ],
      packageConditions: {
        development: {
          "@jsenv/server/": false,
        },
      },
      ignore: {
        "file://**/node_modules/": true,
        // selectively unignore some node_modules
        "file://**/node_modules/@jsenv/assert/": false,
        "file://**/node_modules/@jsenv/abort/": false,
        "file://**/node_modules/@jsenv/ast/": true, // cannot inline "parse5", "@babel/core" and "postcss"
        "file://**/node_modules/@jsenv/filesystem/": false,
        "file://**/node_modules/@jsenv/importmap/": false,
        "file://**/node_modules/@jsenv/integrity/": false,
        "file://**/node_modules/@jsenv/humanize/": false,
        "file://**/node_modules/@jsenv/terminal-table/": false,
        "file://**/node_modules/@jsenv/terminal-text-size/": false,
        "file://**/node_modules/emoji-regex-xs/": false,
        "file://**/node_modules/get-east-asian-width/": false,
        "file://**/node_modules/@jsenv/node-esm-resolution/": false,
        // "file://**/node_modules/@jsenv/server/": false,
        "file://**/node_modules/@jsenv/plugin-transpilation/": false,
        "file://**/node_modules/@jsenv/plugin-bundling/": false,
        "file://**/node_modules/@jsenv/plugin-minification/": false,
        "file://**/node_modules/@jsenv/sourcemap/": true, // cannot inline "source-map"
        "file://**/node_modules/@jsenv/url-meta/": false,
        "file://**/node_modules/@jsenv/urls/": false,
        "file://**/node_modules/@jsenv/runtime-compat/": false,
        "file://**/node_modules/@jsenv/utils/": false,
        "file://**/node_modules/@jsenv/os-metrics/": false,
        "file://**/node_modules/ws/": false,
        "file://**/node_modules/ansi-escapes/": false,
        "file://**/node_modules/is-unicode-supported/": false,
        "file://**/node_modules/supports-color/": false,
        "file://**/node_modules/environment/": false,
        "file://**/node_modules/preact/": false,
      },
      directoryReferenceEffect: {
        // @jsenv/core root dir
        [import.meta.resolve("../../")]: "resolve",
        "file://**/babel_helpers/": "copy",
        "**/*": "error",
      },
    },
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
    "./src/plugins/import_meta_hot/client/import_meta_hot.js": {
      buildRelativeUrl: "./client/import_meta_hot/import_meta_hot.js",
      runtimeCompat: clientRuntimeCompat,
    },
    "./src/plugins/protocol_file/client/directory_listing.html": {
      buildRelativeUrl: "./client/directory_listing/directory_listing.html",
      runtimeCompat: clientRuntimeCompat,
      plugins: [jsenvPluginPreact({})],
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
  },
});
