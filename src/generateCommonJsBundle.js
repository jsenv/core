import { resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "./internal/jsenvCoreDirectoryUrl.js"
import { generateBundle } from "./internal/bundling/generateBundle.js"

export const generateCommonJsBundle = ({
  bundleDirectoryRelativeUrl = "./dist/commonjs",
  bundleDefaultExtension = ".cjs",
  node = true,
  ...rest
}) =>
  generateBundle({
    format: "commonjs",
    bundleDirectoryRelativeUrl,
    bundleDefaultExtension,
    node,
    balancerTemplateFileUrl: resolveUrl(
      "./src/internal/bundling/commonjs-balancer-template.js",
      jsenvCoreDirectoryUrl,
    ),
    ...rest,
  })
