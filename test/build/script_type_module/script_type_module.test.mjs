import { build } from "@jsenv/core/src/build/build.js"

await build({
  logLevel: "debug",
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  sourcemapMethod: "file",
  bundling: false,
  versioning: false,
})
