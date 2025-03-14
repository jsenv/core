import { build } from "@jsenv/core/src/build/build.js";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { urlToBasename, urlToFilename } from "@jsenv/urls";

const clientFileSubbuild = (clientFileRelativeUrl, options = {}) => {
  const clientFileUrl = import.meta.resolve(
    `../../src/${clientFileRelativeUrl}`,
  );
  const clientFilebasename = urlToBasename(clientFileUrl);
  const clientFilename = urlToFilename(clientFileUrl);
  return {
    buildDirectoryUrl: import.meta.resolve(
      `../../dist/client/${clientFilebasename}/`,
    ),
    entryPoints: {
      [`./${clientFileRelativeUrl}`]: clientFilename,
    },
    runtimeCompat: { chrome: "89" },
    base: "./",
    ...options,
  };
};

await build({
  sourceDirectoryUrl: import.meta.resolve("../../"),
  buildDirectoryUrl: import.meta.resolve("../../dist/"),
  entryPoints: {
    "./src/main.js": "jsenv_core.js",
  },
  subbuilds: [
    clientFileSubbuild("src/kitchen/client/inline_content.js"),
    clientFileSubbuild("src/plugins/autoreload/client/autoreload.js"),
    clientFileSubbuild(
      "src/plugins/html_syntax_error_fallback/client/html_syntax_error.html",
    ),
    clientFileSubbuild("src/plugins/import_meta_hot/client/import_meta_hot.js"),
    clientFileSubbuild(
      "src/plugins/protocol_file/client/directory_listing.html",
      {
        plugins: [jsenvPluginPreact({})],
      },
    ),
    clientFileSubbuild("src/plugins/ribbon/client/ribbon.js"),
    clientFileSubbuild(
      "src/plugins/server_events/client/server_events_client.js",
    ),
    clientFileSubbuild(
      "src/plugins/server_events/client/server_events_client.js",
    ),
    clientFileSubbuild(
      "packages/internal/plugin-transpilation/src/babel/new_stylesheet/client/new_stylesheet.js",
    ),
    clientFileSubbuild(
      "packages/internal/plugin-transpilation/src/babel/regenerator_runtime/client/regenerator_runtime.js",
    ),
  ],
  ignore: {
    "file://**/node_modules/": true,
    // selectively unignore some node_modules
    "file://**/node_modules/@jsenv/abort/": false,
    "file://**/node_modules/@jsenv/ast/": true, // cannot inline "parse5", "@babel/core" and "postcss"
    "file://**/node_modules/@jsenv/filesystem/": false,
    "file://**/node_modules/@jsenv/importmap/": false,
    "file://**/node_modules/@jsenv/integrity/": false,
    "file://**/node_modules/@jsenv/humanize/": false,
    "file://**/node_modules/@jsenv/node-esm-resolution/": false,
    // "file://**/node_modules/@jsenv/server/": false,
    "file://**/node_modules/@jsenv/plugin-transpilation/": false,
    "file://**/node_modules/@jsenv/plugin-bundling/": false,
    "file://**/node_modules/@jsenv/plugin-minification/": false,
    "file://**/node_modules/@jsenv/sourcemap/": true, // cannot inline "source-map"
    "file://**/node_modules/@jsenv/url-meta/": false,
    "file://**/node_modules/@jsenv/urls/": false,
    "file://**/node_modules/@jsenv/utils/": false,
    "file://**/node_modules/ws/": false,
    "file://**/node_modules/ansi-escapes/": false,
    "file://**/node_modules/is-unicode-supported/": false,
    "file://**/node_modules/supports-color/": false,
    "file://**/node_modules/environment/": false,
    "file://**/node_modules/preact/": false,
  },
  directoryReferenceEffect: (reference) => {
    // @jsenv/core root dir
    if (reference.url === import.meta.resolve("../../")) {
      return "resolve";
    }
    if (reference.url.includes("/babel_helpers/")) {
      return "copy";
    }
    return "error";
  },
  runtimeCompat: {
    node: "20.0",
  },
  scenarioPlaceholders: false,
  mappings: {
    "emoji-regex/index.js": "emoji-regex/index.mjs",
  },
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
  // for debug
  outDirectoryUrl: import.meta.resolve("./.jsenv/"),
});
