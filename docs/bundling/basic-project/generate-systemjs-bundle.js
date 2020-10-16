import { generateBundle } from "@jsenv/core"

generateBundle({
  format: "systemjs",
  projectDirectoryUrl: new URL("./", import.meta.url),
})
