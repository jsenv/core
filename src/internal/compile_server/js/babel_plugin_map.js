import { createDetailedMessage } from "@jsenv/logger"

import { loadBabelPluginMapFromFile } from "./load_babel_plugin_map_from_file.js"

import { babelPluginSyntaxes } from "./babel_plugin_syntaxes.js"
import { babelPluginMetadataUrlMentions } from "./babel_plugin_metadata_url_mentions.js"
import { babelPluginProxyExternalUrls } from "./babel_plugin_proxy_external_urls.js"
import { babelPluginImportAssertions } from "./babel_plugin_import_assertions.js"
import { babelPluginNewStylesheetAsJsenvImport } from "./babel_plugin_new_stylesheet_as_jsenv_import.js"
import { babelPluginGlobalThisAsJsenvImport } from "./babel_plugin_global_this_as_jsenv_import.js"
import { babelPluginRegeneratorRuntimeAsJsenvImport } from "./babel_plugin_regenerator_runtime_as_jsenv_import.js"
import { babelPluginReplaceExpressions } from "./babel_plugin_replace_expressions.js"

export const loadBabelPluginMap = async ({
  logger,
  projectDirectoryUrl,
  sourceFileFetcher,

  babelPluginMap,
  babelConfigFile,
  babelConfigFileUrl,
  processEnvNodeEnv,
  replaceProcessEnvNodeEnv,
  replaceGlobalObject,
  replaceGlobalFilename,
  replaceGlobalDirname,
  replaceMap,
}) => {
  const babelPluginMapFromFile = babelConfigFile
    ? await loadBabelPluginMapFromFile({
        projectDirectoryUrl,
        babelConfigFileUrl,
      })
    : {}
  babelPluginMap = {
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
  babelPluginMap = {
    ...babelPluginMap,
    "transform-import-assertions": [babelPluginImportAssertions],
    "global-this-as-jsenv-import": [babelPluginGlobalThisAsJsenvImport],
    "new-stylesheet-as-jsenv-import": [babelPluginNewStylesheetAsJsenvImport],
    "regenerator-runtime-as-jsenv-import": [
      babelPluginRegeneratorRuntimeAsJsenvImport,
    ],
  }

  // "babelPluginMapForJsenv" is special:
  // - the babel plugin options are taken into acount in compile profile
  // - BUT they cannot be missing features
  const babelPluginMapForJsenv = {
    "syntaxes": [babelPluginSyntaxes],
    "metadata-url-mentions": [babelPluginMetadataUrlMentions],
    "proxy-external-urls": [
      babelPluginProxyExternalUrls,
      { sourceFileFetcher },
    ],
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
  }
  return {
    ...babelPluginMap,
    ...babelPluginMapForJsenv,
  }
}

export const isBabelPluginForJsenv = (babelPluginName) =>
  BABEL_PLUGIN_NAMES_FOR_JSENV.includes(babelPluginName)

const BABEL_PLUGIN_NAMES_FOR_JSENV = [
  "syntaxes",
  "metadata-url-mentions",
  "proxy-external-urls",
  "transform-replace-expressions",
]

const __filenameReplacement = `import.meta.url.slice('file:///'.length)`

const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`
