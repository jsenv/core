import { build } from "@jsenv/core"

await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  minify: false,
  runtimeSupport: {
    chrome: "55",
    edge: "14",
    firefox: "52",
    safari: "11",
  },
})
