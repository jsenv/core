import { build } from "@jsenv/core";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./client/xterm.html": {
      base: "./",
      runtimeCompat: { chrome: "100" },
      minification: false,
      versioning: false,
    },
    "./main_browser.js": {
      base: "./",
      buildRelativeUrl: "terminal_recorder_browser.js",
      runtimeCompat: { chrome: "100" },
      plugins: [
        jsenvPluginCommonJs({
          include: {
            "file:///**/node_modules/he/": true,
          },
        }),
      ],
      minification: false,
      versioning: false,
    },
  },
});
