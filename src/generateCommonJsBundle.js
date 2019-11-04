import { resolveFileUrl } from "./private/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "./private/jsenvCoreDirectoryUrl.js"
import { generateBundle } from "./private/bundle/generateBundle/generateBundle.js"

export const generateCommonJsBundle = async ({
  bundleDirectoryRelativePath = "./dist/commonjs",
  node = true,
  ...rest
}) =>
  generateBundle({
    format: "commonjs",
    bundleDirectoryRelativePath,
    node,
    balancerTemplateFileUrl: resolveFileUrl(
      "./src/private/bundle/commonjs-balancer-template.js",
      jsenvCoreDirectoryUrl,
    ),
    balancerDataAbstractSpecifier: "/.jsenv/commonjs-balancer-data.js",
    ...rest,
  })
