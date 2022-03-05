import { buildProject } from "@jsenv/core/src/build/build_project.js"

await buildProject({
  projectDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "./main.html",
  },
})
