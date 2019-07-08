import { generateBundle } from "../generate-bundle.js"
import { DEFAULT_BUNDLE_INTO_RELATIVE_PATH } from "./generate-global-bundle-constant.js"

export const generateGlobalBundle = async ({
  projectPath,
  bundleIntoRelativePath = DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
  globalName,
  importMapRelativePath,
  specifierMap,
  dynamicSpecifierMap,
  entryPointMap,
  babelPluginMap,
  logLevel,
  minify,
  throwUnhandled,
  writeOnFileSystem,
  platformScoreMap,
  platformAlwaysInsidePlatformScoreMap,
}) =>
  generateBundle({
    format: "global",
    formatOutputOptions: globalName
      ? {
          name: globalName,
        }
      : {},
    projectPath,
    bundleIntoRelativePath,
    importMapRelativePath,
    specifierMap,
    dynamicSpecifierMap,
    entryPointMap,
    babelPluginMap,
    logLevel,
    minify,
    throwUnhandled,
    writeOnFileSystem,
    compileGroupCount: 1,
    platformScoreMap,
    platformAlwaysInsidePlatformScoreMap,
  })
