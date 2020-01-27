import { generateBundle } from "./internal/bundling/generateBundle.js"

export const generateGlobalBundle = async ({
  bundleDirectoryRelativeUrl = "./dist/global",
  globalName,
  browser = true,
  ...rest
}) =>
  generateBundle({
    format: "global",
    browser,
    formatOutputOptions: globalName
      ? {
          name: globalName,
        }
      : {},
    bundleDirectoryRelativeUrl,
    compileGroupCount: 1,
    ...rest,
  })
