import { createDetailedMessage } from "@jsenv/logger"

import { loadBabelPluginMapFromFile } from "./load_babel_plugin_map_from_file.js"
import {
  getMinimalBabelPluginMap,
  extractSyntaxBabelPluginMap,
} from "./babel_plugins.js"

import { babelPluginImportMetadata } from "./babel_plugin_import_metadata.js"
import { babelPluginProxyExternalImports } from "./babel_plugin_proxy_external_imports.js"
import { babelPluginImportAssertions } from "./babel_plugin_import_assertions.js"
import { babelPluginNewStylesheetAsJsenvImport } from "./babel_plugin_new_stylesheet_as_jsenv_import.js"
import { babelPluginGlobalThisAsJsenvImport } from "./babel_plugin_global_this_as_jsenv_import.js"
import { babelPluginRegeneratorRuntimeAsJsenvImport } from "./babel_plugin_regenerator_runtime_as_jsenv_import.js"
import { babelPluginReplaceExpressions } from "./babel_plugin_replace_expressions.js"

export const loadBabelPluginMap = async ({
  logger,
  projectDirectoryUrl,
  jsenvRemoteDirectory,

  babelPluginMap,
  babelConfigFileUrl,
  transformGenerator,
  processEnvNodeEnv,
  replaceProcessEnvNodeEnv,
  replaceGlobalObject,
  replaceGlobalFilename,
  replaceGlobalDirname,
  replaceMap,
}) => {
  const babelPluginMapFromFile = await loadBabelPluginMapFromFile({
    projectDirectoryUrl,
    babelConfigFileUrl,
  })
  babelPluginMap = {
    ...getMinimalBabelPluginMap(),
    "global-this-as-jsenv-import": babelPluginGlobalThisAsJsenvImport,
    "new-stylesheet-as-jsenv-import": babelPluginNewStylesheetAsJsenvImport,
    "transform-import-assertions": babelPluginImportAssertions,
    ...babelPluginMapFromFile,
    ...babelPluginMap,
  }
  Object.keys(babelPluginMap).forEach((key) => {
    if (
      key === "transform-modules-commonjs" ||
      key === "transform-modules-amd" ||
      key === "transform-modules-systemjs"
    ) {
      const declaredInFile = Boolean(babelPluginMapFromFile[key])
      logger.warn(
        createDetailedMessage(
          `WARNING: "${key}" babel plugin should not be enabled, it will be ignored`,
          {
            suggestion: declaredInFile
              ? `To get rid of this warning, remove "${key}" from babel config file. Either with "modules": false in @babel/preset-env or removing "@babel/${key}" from plugins`
              : `To get rid of this warning, remove "${key}" from babelPluginMap parameter`,
          },
        ),
      )
      delete babelPluginMap[key]
    }
  })
  const { babelSyntaxPluginMap, babelPluginMapWithoutSyntax } =
    extractSyntaxBabelPluginMap(babelPluginMap)

  babelPluginMap = {
    // When code should be compatible with browsers, ensure
    // process.env.NODE_ENV is replaced to be executable in a browser by forcing
    // "transform-replace-expressions" babel plugin.
    // It happens for module written in ESM but also using process.env.NODE_ENV
    // for example "react-redux"
    // This babel plugin won't force compilation because it's added after "featureNames"
    // however it will be used even if not part of "missingFeatureNames"
    // as visible in "babelPluginMapFromCompileId"
    // This is a quick workaround to get things working because:
    // - If none of your code needs to be compiled but one of your dependency
    //   uses process.env.NODE_ENV, the code will throw "process" is undefined
    //   This is fine but you won't have a dedicated way to force compilation to ensure
    //   "process.env.NODE_ENV" is replaced.
    // Ideally this should be a custom compiler dedicated for this use case. It's not the case
    // for now because it was faster to do it this way and the use case is a bit blurry:
    // What should this custom compiler do? Just replace some node globals? How would it be named and documented?
    "transform-replace-expressions": [
      babelPluginReplaceExpressions,
      {
        replaceMap: {
          ...(replaceProcessEnvNodeEnv
            ? { "process.env.NODE_ENV": `("${processEnvNodeEnv}")` }
            : {}),
          ...(replaceGlobalObject ? { global: "globalThis" } : {}),
          ...(replaceGlobalFilename
            ? { __filename: __filenameReplacement }
            : {}),
          ...(replaceGlobalDirname ? { __dirname: __dirnameReplacement } : {}),
          ...replaceMap,
        },
        allowConflictingReplacements: true,
      },
    ],
    ...babelSyntaxPluginMap,
    ...babelPluginMap,
    ...(transformGenerator
      ? {
          "regenerator-runtime-as-jsenv-import": [
            babelPluginRegeneratorRuntimeAsJsenvImport,
          ],
        }
      : {}),
    ...(jsenvRemoteDirectory
      ? {
          "proxy-external-imports": [
            babelPluginProxyExternalImports,
            { jsenvRemoteDirectory },
          ],
        }
      : {}),
    "import-metadata": [babelPluginImportMetadata],
  }
  return {
    babelPluginMap,
    babelSyntaxPluginMap,
    babelPluginMapWithoutSyntax,
  }
}

const __filenameReplacement = `import.meta.url.slice('file:///'.length)`

const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`
