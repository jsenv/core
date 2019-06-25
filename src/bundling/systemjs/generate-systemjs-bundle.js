import { generateBundle } from "../generate-bundle.js"
import { DEFAULT_BUNDLE_INTO_RELATIVE_PATH } from "./generate-systemjs-bundle-constant.js"

export const generateSystemJsBundle = async ({
  projectPath,
  bundleIntoRelativePath = DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
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
    format: "systemjs",
    balancerTemplateRelativePath: "/src/bundling/systemjs/systemjs-balancer-template.js",
    balancerDataClientPathname: "/.jsenv/systemjs-balancer-data.js",
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
