import { fileURLToPath } from "node:url"
import { urlToRelativeUrl } from "@jsenv/urls"
import { readFileSync } from "@jsenv/filesystem"
import {
  createMagicSource,
  composeTwoSourcemaps,
  SOURCEMAP,
} from "@jsenv/sourcemap"
import { applyBabelPlugins } from "@jsenv/ast"

import { requireFromJsenv } from "@jsenv/core/src/require_from_jsenv.js"
import { requireBabelPlugin } from "../babel/require_babel_plugin.js"
import { babelPluginTransformImportMetaUrl } from "./helpers/babel_plugin_transform_import_meta_url.js"
import { babelPluginTransformImportMetaResolve } from "./helpers/babel_plugin_transform_import_meta_resolve.js"

// import { jsenvPluginAsJsClassicLibrary } from "./jsenv_plugin_as_js_classic_library.js"
// because of https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/84
import customAsyncToPromises from "./async-to-promises.js"

/*
 * When systemjs format is used by babel, it will generated UID based on
 * the import specifier:
 * https://github.com/babel/babel/blob/97d1967826077f15e766778c0d64711399e9a72a/packages/babel-plugin-transform-modules-systemjs/src/index.ts#L498
 * But at this stage import specifier are absolute file urls
 * So without minification these specifier are long and dependent
 * on where the files are on the filesystem.
 * This can be mitigated by minification that will rename them.
 * But to fix this issue once and for all I have copy-pasted
 * "@babel/plugin-transform-modules-systemjs" to introduce
 * "generateIdentifierHint" options and prevent that from hapenning
 */
const TRANSFORM_MODULES_SYSTEMJS_PATH = fileURLToPath(
  new URL("./babel_plugin_transform_modules_systemjs.cjs", import.meta.url),
)

export const convertJsModuleToJsClassic = async ({
  rootDirectoryUrl,
  systemJsInjection,
  systemJsClientFileUrl,
  urlInfo,
  jsModuleUrlInfo,
}) => {
  let jsClassicFormat
  if (urlInfo.isEntryPoint && !jsModuleUrlInfo.data.usesImport) {
    // if it's an entry point without dependency (it does not use import)
    // then we can use UMD
    jsClassicFormat = "umd"
  } else {
    // otherwise we have to use system in case it's imported
    // by an other file (for entry points)
    // or to be able to import when it uses import
    jsClassicFormat = "system"
  }

  urlInfo.data.jsClassicFormat = jsClassicFormat
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [
      ...(jsClassicFormat === "system"
        ? [
            // proposal-dynamic-import required with systemjs for babel8:
            // https://github.com/babel/babel/issues/10746
            requireFromJsenv("@babel/plugin-proposal-dynamic-import"),
            [
              // eslint-disable-next-line import/no-dynamic-require
              requireFromJsenv(TRANSFORM_MODULES_SYSTEMJS_PATH),
              {
                generateIdentifierHint: (key) => {
                  if (key.startsWith("file://")) {
                    return urlToRelativeUrl(key, rootDirectoryUrl)
                  }
                  return key
                },
              },
            ],
            [
              customAsyncToPromises,
              {
                asyncAwait: false, // already handled + we might not needs it at all
                topLevelAwait: "return",
              },
            ],
          ]
        : [
            [
              requireBabelPlugin("babel-plugin-transform-async-to-promises"),
              {
                asyncAwait: false, // already handled + we might not needs it at all
                topLevelAwait: "simple",
              },
            ],
            babelPluginTransformImportMetaUrl,
            babelPluginTransformImportMetaResolve,
            requireFromJsenv("@babel/plugin-transform-modules-umd"),
          ]),
    ],
    urlInfo: jsModuleUrlInfo,
  })
  let sourcemap = jsModuleUrlInfo.sourcemap
  sourcemap = await composeTwoSourcemaps(sourcemap, map)
  if (
    systemJsInjection &&
    jsClassicFormat === "system" &&
    urlInfo.isEntryPoint
  ) {
    const magicSource = createMagicSource(code)
    let systemJsFileContent = readFileSync(systemJsClientFileUrl, {
      as: "string",
    })
    const sourcemapFound = SOURCEMAP.readComment({
      contentType: "text/javascript",
      content: systemJsFileContent,
    })
    if (sourcemapFound) {
      // for now let's remove s.js sourcemap
      // because it would likely mess the sourcemap of the entry point itself
      systemJsFileContent = SOURCEMAP.writeComment({
        contentType: "text/javascript",
        content: systemJsFileContent,
        specifier: "",
      })
    }
    magicSource.prepend(`${systemJsFileContent}\n\n`)
    const magicResult = magicSource.toContentAndSourcemap()
    sourcemap = await composeTwoSourcemaps(sourcemap, magicResult.sourcemap)
    return {
      content: magicResult.content,
      sourcemap,
    }
  }
  return {
    content: code,
    sourcemap,
  }
}
