import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./main_node.js": {
      buildRelativeUrl: "./node/jsenv_humanize_node.js",
      runtimeCompat: { node: "20" },
    },
    "./main_browser.js": {
      buildRelativeUrl: "./browser/jsenv_humanize_browser.js",
      runtimeCompat: {
        chrome: "64",
        edge: "79",
        firefox: "67",
        safari: "11.3",
      },
      minification: false,
      versioning: false,
    },
  },
});
