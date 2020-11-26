import { buildProject } from "@jsenv/core"

buildProject({
  format: "commonjs",
  projectDirectoryUrl: new URL("./", import.meta.url),
})
