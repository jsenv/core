import { generateBundle } from "@jsenv/core"

generateBundle({
  format: "commonjs",
  projectDirectoryUrl: new URL("./", import.meta.url),
})
