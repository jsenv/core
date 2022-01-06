import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "dist",
  entryPoints: {
    "./file.js": "file.js",
  },
  format: "systemjs",
  runtimeSupport: {
    chrome: "65",
    edge: "17",
    firefox: "72",
    safari: "14",
  },
})
