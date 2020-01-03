import { resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { generateBundle } from "internal/bundling/generateBundle.js"

export const generateSystemJsBundle = async ({
  bundleDirectoryRelativeUrl = "./dist/systemjs",
  ...rest
}) =>
  generateBundle({
    format: "systemjs",
    balancerTemplateFileUrl: resolveUrl(
      "./src/internal/bundling/systemjs-balancer-template.js",
      jsenvCoreDirectoryUrl,
    ),
    bundleDirectoryRelativeUrl,
    ...rest,
  })
