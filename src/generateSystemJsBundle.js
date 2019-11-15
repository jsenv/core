import { resolveFileUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { generateBundle } from "internal/bundling/generateBundle/generateBundle.js"

export const generateSystemJsBundle = async ({
  bundleDirectoryRelativePath = "./dist/systemjs",
  ...rest
}) =>
  generateBundle({
    format: "systemjs",
    balancerTemplateFileUrl: resolveFileUrl(
      "./src/internal/bundle/systemjs-balancer-template.js",
      jsenvCoreDirectoryUrl,
    ),
    balancerDataAbstractSpecifier: "/.jsenv/systemjs-balancer-data.js",
    bundleDirectoryRelativePath,
    ...rest,
  })
