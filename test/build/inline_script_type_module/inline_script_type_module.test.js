import { build } from "@jsenv/core/src/build/build.js"

await build({
  logLevel: "debug",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
})
