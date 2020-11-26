import { buildProject } from "@jsenv/core"

buildProject({
  format: "esmodule",
  projectDirectoryUrl: new URL("./", import.meta.url),
})
