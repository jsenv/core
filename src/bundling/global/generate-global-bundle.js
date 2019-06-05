import { generateBundle } from "../generate-bundle.js"
import { DEFAULT_BUNDLE_INTO_RELATIVE_PATH } from "./generate-global-bundle-constant.js"

export const generateGlobalBundle = async ({
  projectPath,
  bundleIntoRelativePath = DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
  globalName,
  importMapRelativePath,
  entryPointMap,
  inlineSpecifierMap,
  babelPluginMap,
  logLevel,
  minify,
  throwUnhandled,
  writeOnFileSystem,
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
    entryPointMap,
    inlineSpecifierMap,
    babelPluginMap,
    logLevel,
    minify,
    throwUnhandled,
    writeOnFileSystem,
  })
