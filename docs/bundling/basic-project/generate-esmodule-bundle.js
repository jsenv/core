import { generateEsModuleBundle } from "@jsenv/core"

generateEsModuleBundle({
  projectDirectoryUrl: new URL("./", import.meta.url),
})
