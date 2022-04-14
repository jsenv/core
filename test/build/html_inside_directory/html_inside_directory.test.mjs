import { build } from "@jsenv/core"

await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./src/main.html": "main.html",
  },
  minification: false,
})
