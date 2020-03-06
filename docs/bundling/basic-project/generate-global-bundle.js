import { generateGlobalBundle } from "@jsenv/core"

generateGlobalBundle({
  projectDirectoryUrl: new URL("./", import.meta.url),
  globalName: "__whatever__",
})
