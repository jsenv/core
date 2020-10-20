import { generateBundle } from "@jsenv/core"

generateBundle({
  format: "esmodule",
  projectDirectoryUrl: new URL("./", import.meta.url),
})
