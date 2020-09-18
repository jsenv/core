import { resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "./internal/jsenvCoreDirectoryUrl.js"
import { generateBundle } from "./internal/bundling/generateBundle.js"

export const generateCommonJsBundle = ({
  bundleDirectoryRelativeUrl = "./dist/commonjs",
  node = true,
  formatOutputOptions = {},
  ...rest
}) =>
  generateBundle({
    format: "commonjs",
    bundleDirectoryRelativeUrl,
    node,
    formatOutputOptions: {
      ...formatOutputOptions,
      // by default it's [name].js
      entryFileNames: `[name].cjs`,
      chunkFileNames: `[name]-[hash].cjs`,
    },
    balancerTemplateFileUrl: resolveUrl(
      "./src/internal/bundling/commonjs-balancer-template.js",
      jsenvCoreDirectoryUrl,
    ),
    ...rest,
  })
