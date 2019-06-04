import { generateBundle } from "../generate-bundle.js"
import {
  DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  DEFAULT_ENTRY_POINT_MAP,
  DEFAULT_PLATFORM_GROUP_RESOLVER_RELATIVE_PATH,
  DEFAULT_BABEL_PLUGIN_MAP,
  DEFAULT_PLATFORM_SCORE_MAP,
} from "./bundle-systemjs-constant.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../../logger.js"

export const generateSystemJsBundle = async ({
  projectPath,
  bundleIntoRelativePath = DEFAULT_BUNDLE_INTO_RELATIVE_PATH,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  entryPointMap = DEFAULT_ENTRY_POINT_MAP,
  platformGroupResolverRelativePath = DEFAULT_PLATFORM_GROUP_RESOLVER_RELATIVE_PATH,
  inlineSpecifierMap = {},
  babelPluginMap = DEFAULT_BABEL_PLUGIN_MAP,
  compileGroupCount = 1,
  platformScoreMap = DEFAULT_PLATFORM_SCORE_MAP,
  logLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
  minify = false,
  throwUnhandled = true,
  writeOnFileSystem = true,
}) =>
  generateBundle({
    projectPath,
    bundleIntoRelativePath,
    importMapRelativePath,
    entryPointMap,
    platformGroupResolverRelativePath,
    inlineSpecifierMap,
    babelPluginMap,
    compileGroupCount,
    platformScoreMap,
    logLevel,
    minify,
    throwUnhandled,
    writeOnFileSystem,
  })
