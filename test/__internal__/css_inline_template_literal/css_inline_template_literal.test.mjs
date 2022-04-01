import { build } from "@jsenv/core"

await build({
  logLevel: "debug",
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.js": "main.js",
  },
  // bundling: false,
  versioning: "none",
})
