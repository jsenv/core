import { resolveFileUrl } from "./private/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "./private/jsenvCoreDirectoryUrl.js"
import { generateBundle } from "./private/bundle/generateBundle/generateBundle.js"

export const generateSystemJsBundle = async ({
  bundleDirectoryRelativePath = "./dist/systemjs",
  ...rest
}) =>
  generateBundle({
    format: "systemjs",
    balancerTemplateFileUrl: resolveFileUrl(
      "./src/private/bundle/systemjs-balancer-template.js",
      jsenvCoreDirectoryUrl,
    ),
    balancerDataAbstractSpecifier: "/.jsenv/systemjs-balancer-data.js",
    bundleDirectoryRelativePath,
    ...rest,
  })
