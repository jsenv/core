import { buildProject } from "@jsenv/core"

buildProject({
  format: "systemjs",
  projectDirectoryUrl: new URL("./", import.meta.url),
})
