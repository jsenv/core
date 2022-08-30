import { readFileSync } from "@jsenv/filesystem"
import { createMagicSource, composeTwoSourcemaps } from "@jsenv/sourcemap"
import { applyBabelPlugins } from "@jsenv/ast"

import { requireFromJsenv } from "@jsenv/core/src/require_from_jsenv.js"
import { requireBabelPlugin } from "../babel/require_babel_plugin.js"
import { babelPluginTransformImportMetaUrl } from "./helpers/babel_plugin_transform_import_meta_url.js"

// import { jsenvPluginAsJsClassicLibrary } from "./jsenv_plugin_as_js_classic_library.js"
// because of https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/84
import customAsyncToPromises from "./async-to-promises.js"

export const convertJsModuleToJsClassic = async ({
  systemJsInjection,
  systemJsClientFileUrl,
  urlInfo,
  jsModuleUrlInfo,
}) => {
  const jsClassicFormat =
    // in general html file are entry points, but js can be entry point when:
    // - passed in entryPoints to build
    // - is used by web worker
    // - the reference contains ?entry_point
    // When js is entry point there can be no HTML to inject systemjs
    // and systemjs must be injected into the js file
    urlInfo.isEntryPoint &&
    // if it's an entry point without dependency (it does not use import)
    // then we can use UMD, otherwise we have to use systemjs
    // because it is imported by systemjs
    !jsModuleUrlInfo.data.usesImport
      ? "umd"
      : "system"
  urlInfo.data.jsClassicFormat = jsClassicFormat
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [
      ...(jsClassicFormat === "system"
        ? [
            // proposal-dynamic-import required with systemjs for babel8:
            // https://github.com/babel/babel/issues/10746
            requireFromJsenv("@babel/plugin-proposal-dynamic-import"),
            requireFromJsenv("@babel/plugin-transform-modules-systemjs"),
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
    const systemjsCode = readFileSync(systemJsClientFileUrl, { as: "string" })
    magicSource.prepend(`${systemjsCode}\n\n`)
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
