import { generateBundle } from "./internal/bundle/generateBundle/generateBundle.js"

export const generateGlobalBundle = async ({
  bundleDirectoryRelativePath = "./dist/global",
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
    bundleDirectoryRelativePath,
    compileGroupCount: 1,
    ...rest,
  })
