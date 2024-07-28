import { build } from "@jsenv/core";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./client/xterm.html": "xterm.html",
  },
  runtimeCompat: {
    chrome: "100",
  },
  minification: false,
  versioning: false,
});

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main_browser.js": "terminal_recorder_browser.js",
  },
  runtimeCompat: {
    chrome: "100",
  },
  plugins: [
    jsenvPluginCommonJs({
      include: {
        "file:///**/node_modules/he/": true,
        "file:///**/node_modules/string-width/": true,
        "file:///**/node_modules/emoji-regex/": true,
      },
    }),
  ],
  minification: false,
  versioning: false,
  directoryToClean: false,
});
