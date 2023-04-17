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

export const convertJsModuleToJsClassic = async ({
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
            requireFromJsenv("@babel/plugin-transform-modules-systemjs"),
            [babelPluginRelativeImports, { rootUrl: jsModuleUrlInfo.url }],
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
            [babelPluginRelativeImports, { rootUrl: jsModuleUrlInfo.url }],
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

/*
 * When systemjs or umd format is used by babel, it will generated UID based on
 * the import specifier:
 * https://github.com/babel/babel/blob/97d1967826077f15e766778c0d64711399e9a72a/packages/babel-plugin-transform-modules-systemjs/src/index.ts#L498
 * But at this stage import specifier are absolute file urls
 * This can be mitigated by minification that will rename them.
 * But to fix this issue once and for all there is babelPluginRelativeImports below
 */
const babelPluginRelativeImports = (babel) => {
  const t = babel.types

  const replaceSpecifierAtPath = (path, state) => {
    const specifier = path.node.value
    if (specifier.startsWith("file://")) {
      const specifierRelative = urlToRelativeUrl(specifier, state.opts.rootUrl)
      path.replaceWith(t.stringLiteral(specifierRelative))
    }
  }

  return {
    name: "relative-imports",
    visitor: {
      CallExpression: (path, state) => {
        if (path.node.callee.type !== "Import") {
          // Some other function call, not import();
          return
        }
        if (path.node.arguments[0].type !== "StringLiteral") {
          // Non-string argument, probably a variable or expression, e.g.
          // import(moduleId)
          // import('./' + moduleName)
          return
        }
        const sourcePath = path.get("arguments")[0]
        if (sourcePath.node.type === "StringLiteral") {
          replaceSpecifierAtPath(sourcePath, state)
        }
      },
      ImportDeclaration: (path, state) => {
        const sourcePath = path.get("source")
        replaceSpecifierAtPath(sourcePath, state)
      },
      ExportAllDeclaration: (path, state) => {
        const sourcePath = path.get("source")
        replaceSpecifierAtPath(sourcePath, state)
      },
      ExportNamedDeclaration: (path, state) => {
        if (!path.node.source) {
          // This export has no "source", so it's probably
          // a local variable or function, e.g.
          // export { varName }
          // export const constName = ...
          // export function funcName() {}
          return
        }
        const sourcePath = path.get("source")
        if (sourcePath.node.type === "StringLiteral") {
          replaceSpecifierAtPath(sourcePath, state)
        }
      },
    },
  }
}
