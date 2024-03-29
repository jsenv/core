import { build } from "@jsenv/core";

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
