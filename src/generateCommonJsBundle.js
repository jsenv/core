import { resolveFileUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { generateBundle } from "internal/bundling/generateBundle/generateBundle.js"

export const generateCommonJsBundle = async ({
  bundleDirectoryRelativeUrl = "./dist/commonjs",
  node = true,
  ...rest
}) =>
  generateBundle({
    format: "commonjs",
    bundleDirectoryRelativeUrl,
    node,
    balancerTemplateFileUrl: resolveFileUrl(
      "./src/internal/bundling/commonjs-balancer-template.js",
      jsenvCoreDirectoryUrl,
    ),
    balancerDataAbstractSpecifier: "/.jsenv/commonjs-balancer-data.js",
    ...rest,
  })
