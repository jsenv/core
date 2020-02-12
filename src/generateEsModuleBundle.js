import { generateBundle } from "./internal/bundling/generateBundle.js"

export const generateEsModuleBundle = ({
  bundleDirectoryRelativeUrl = "./dist/esmodule",
  ...rest
}) =>
  generateBundle({
    format: "esm",
    bundleDirectoryRelativeUrl,
    ...rest,
  })
