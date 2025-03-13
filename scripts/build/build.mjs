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
    bundling: {
      js_module: {
        chunks: false,
      },
    },
    ...options,
  };
};

await build({
  sourceDirectoryUrl: import.meta.resolve("../../src/"),
  buildDirectoryUrl: import.meta.resolve("../../dist/"),
  entryPoints: {
    "./main.js": "jsenv_core.js",
  },
  subbuilds: [
    clientFileSubbuild("plugins/autoreload/client/autoreload.js"),
    clientFileSubbuild(
      "plugins/html_syntax_error_fallback/client/html_syntax_error.html",
    ),
    clientFileSubbuild("plugins/import_meta_hot/client/import_meta_hot.js"),
    clientFileSubbuild("plugins/protocol_file/client/directory_listing.html", {
      plugins: [jsenvPluginPreact({})],
    }),
    clientFileSubbuild("plugins/ribbon/client/ribbon.js"),
    clientFileSubbuild("plugins/server_events/client/server_events_client.js"),
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
  plugins: [
    {
      redirectReference: (reference) => {
        if (reference.url.endsWith("emoji-regex/index.js")) {
          return reference.url.replace("index.js", "index.mjs");
        }
        return null;
      },
    },
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
