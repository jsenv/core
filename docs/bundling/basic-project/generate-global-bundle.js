import { generateBundle } from "@jsenv/core"

generateBundle({
  format: "global",
  projectDirectoryUrl: new URL("./", import.meta.url),
  globalName: "__whatever__",
})
