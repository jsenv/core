import { generateSystemJsBundle } from "@jsenv/core"

generateSystemJsBundle({
  projectDirectoryUrl: new URL("./", import.meta.url),
})
