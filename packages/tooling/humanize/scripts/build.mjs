import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./main_node.js": {
      mode: "package",
      buildRelativeUrl: "./node/jsenv_humanize_node.js",
      runtimeCompat: { node: "20" },
    },
    "./main_browser.js": {
      mode: "package",
      buildRelativeUrl: "./browser/jsenv_humanize_browser.js",
      runtimeCompat: { chrome: "90" },
      minification: false,
      versioning: false,
    },
  },
});
