import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/browser/", import.meta.url),
  entryPoints: {
    "./main_browser.js": "jsenv_inspect_browser.js",
  },
  runtimeCompat: {
    chrome: "64",
    edge: "79",
    firefox: "67",
    safari: "11.3",
  },
  minification: false,
  versioning: false,
});

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/node/", import.meta.url),
  entryPoints: {
    "./main_node.js": "jsenv_inspect_node.js",
  },
  runtimeCompat: {
    node: "20",
  },
  minification: false,
  versioning: false,
});
