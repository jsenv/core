import { buildProject } from "@jsenv/core"

buildProject({
  format: "global",
  projectDirectoryUrl: new URL("./", import.meta.url),
  globalName: "__whatever__",
})
