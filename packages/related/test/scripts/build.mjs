import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./main.js": {
      buildRelativeUrl: "./jsenv_test.js",
      runtimeCompat: { node: "20.0" },
      directoryReferenceEffect: (reference) => {
        if (
          reference.type === "js_url" &&
          reference.ownerUrlInfo.url.endsWith("/exception.js")
        ) {
          return "preserve";
        }
        return "error";
      },
      ignore: {
        "file://**/node_modules/": true,
        // selectively allow some node_modules
        "file://**/node_modules/@jsenv/abort/": false,
        "file://**/node_modules/@jsenv/filesystem/": false,
        "file://**/node_modules/@jsenv/importmap/": false,
        "file://**/node_modules/@jsenv/humanize/": false,
        "file://**/node_modules/@jsenv/integrity/": false,
        "file://**/node_modules/@jsenv/url-meta/": false,
        "file://**/node_modules/@jsenv/urls/": false,
        "file://**/node_modules/@jsenv/utils/": false,
        "file://**/node_modules/ansi-escapes/": false,
        "file://**/node_modules/errorstacks/": false,
        "file://**/node_modules/is-unicode-supported/": false,
        "file://**/node_modules/supports-color/": false,
        "file://**/node_modules/environment/": false,
        "file://**/node_modules/@jsenv/os-metrics/": false,
      },
      scenarioPlaceholders: false,
    },
  },
});
