import { generateCommonJsBundle } from "@jsenv/core"

generateCommonJsBundle({
  projectDirectoryUrl: new URL("./", import.meta.url),
})
