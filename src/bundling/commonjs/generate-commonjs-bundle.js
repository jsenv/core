import { generateBundle } from "../generate-bundle.js"
import {
  DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
  DEFAULT_BALANCER_TEMPLATE_RELATIVE_PATH,
} from "./generate-commonjs-bundle-constant.js"

export const generateCommonJsBundle = async ({
  projectPath,
  bundleIntoRelativePath = DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
  balancerTemplateRelativePath = DEFAULT_BALANCER_TEMPLATE_RELATIVE_PATH,
  importMapRelativePath,
  entryPointMap,
  inlineSpecifierMap,
  babelPluginMap,
  logLevel,
  minify,
  throwUnhandled,
  writeOnFileSystem,
  compileGroupCount,
  platformGroupResolverRelativePath,
  platformScoreMap,
  platformAlwaysInsidePlatformScoreMap,
}) =>
  generateBundle({
    format: "commonjs",
    balancerTemplateRelativePath,
    balancerDataClientPathname: "/.jsenv/commonjs-balancer-data.js",
    projectPath,
    bundleIntoRelativePath,
    importMapRelativePath,
    entryPointMap,
    inlineSpecifierMap,
    babelPluginMap,
    logLevel,
    minify,
    throwUnhandled,
    writeOnFileSystem,
    compileGroupCount,
    platformGroupResolverRelativePath,
    platformScoreMap,
    platformAlwaysInsidePlatformScoreMap,
  })
