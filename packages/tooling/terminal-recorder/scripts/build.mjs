import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./client/xterm.html": {
      base: "./",
      runtimeCompat: { chrome: "100" },
      minification: false,
      versioning: false,
      preserveComments: true,
    },
    "./main_browser.js": {
      base: "./",
      buildRelativeUrl: "terminal_recorder_browser.js",
      runtimeCompat: { chrome: "100" },
      minification: false,
      versioning: false,
      preserveComments: true,
    },
  },
});
