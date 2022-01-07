import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "dist",
  entryPoints: {
    "./file.js": "file.js",
  },
  format: "systemjs",
  runtimeSupport: {
    chrome: "55",
    edge: "15",
    firefox: "52",
    safari: "11",
  },
})
