import { resolveUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { generateBundle } from "internal/bundling/generateBundle.js"

export const generateCommonJsBundle = async ({
  bundleDirectoryRelativeUrl = "./dist/commonjs",
  node = true,
  ...rest
}) =>
  generateBundle({
    format: "commonjs",
    bundleDirectoryRelativeUrl,
    node,
    balancerTemplateFileUrl: resolveUrl(
      "./src/internal/bundling/commonjs-balancer-template.js",
      jsenvCoreDirectoryUrl,
    ),
    ...rest,
  })
