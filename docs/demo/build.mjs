import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "dist",
  entryPointMap: {
    "./main.html": "./main.prod.html",
  },
  format: "esmodule",

  minify: false,
})
