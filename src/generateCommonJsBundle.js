import { resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "./internal/jsenvCoreDirectoryUrl.js"
import { generateBundle } from "./internal/bundling/generateBundle.js"

export const generateCommonJsBundle = async ({
  bundleDirectoryRelativeUrl = "./dist/commonjs",
  cjsExtension = true,
  node = true,
  ...rest
}) =>
  generateBundle({
    format: "commonjs",
    bundleDirectoryRelativeUrl,
    node,
    formatOutputOptions: {
      ...(cjsExtension
        ? {
            // by default it's [name].js
            entryFileNames: `[name].cjs`,
          }
        : {}),
    },
    balancerTemplateFileUrl: resolveUrl(
      "./src/internal/bundling/commonjs-balancer-template.js",
      jsenvCoreDirectoryUrl,
    ),
    ...rest,
  })
