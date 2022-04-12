import { build } from "@jsenv/core"

await build({
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./file.js": "file.js",
  },
  format: "systemjs",
  runtimeCompat: {
    chrome: "55",
    edge: "15",
    firefox: "52",
    safari: "11",
  },
})
