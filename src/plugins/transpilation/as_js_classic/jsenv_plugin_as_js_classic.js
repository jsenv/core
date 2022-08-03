/*
 * Something to keep in mind:
 * When systemjs format is used by babel, it will generated UID based on
 * the import specifier:
 * https://github.com/babel/babel/blob/97d1967826077f15e766778c0d64711399e9a72a/packages/babel-plugin-transform-modules-systemjs/src/index.ts#L498
 * But at this stage import specifier are absolute file urls
 * So without minification these specifier are long and dependent
 * on where the files are on the filesystem.
 * This is mitigated by minification that will shorten them
 * But ideally babel should not generate this in the first place
 * and prefer to unique identifier based solely on the specifier basename for instance
 */

import { urlToFilename, injectQueryParams } from "@jsenv/urls"
import { readFileSync } from "@jsenv/filesystem"
import { createMagicSource, composeTwoSourcemaps } from "@jsenv/sourcemap"
import { applyBabelPlugins } from "@jsenv/ast"

import { requireFromJsenv } from "@jsenv/core/src/require_from_jsenv.js"
import { requireBabelPlugin } from "../babel/require_babel_plugin.js"
import { babelPluginTransformImportMetaUrl } from "./helpers/babel_plugin_transform_import_meta_url.js"
import { jsenvPluginAsJsClassicHtml } from "./jsenv_plugin_as_js_classic_html.js"
import { jsenvPluginAsJsClassicWorkers } from "./jsenv_plugin_as_js_classic_workers.js"
// because of https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/84
import customAsyncToPromises from "./async-to-promises.js"

export const jsenvPluginAsJsClassic = ({ systemJsInjection = true }) => {
  const systemJsClientFileUrl = new URL(
    "./client/s.js?js_classic",
    import.meta.url,
  ).href

  return [
    jsenvPluginAsJsClassicConversion({
      systemJsInjection,
      systemJsClientFileUrl,
    }),
    jsenvPluginAsJsClassicHtml({
      systemJsInjection,
      systemJsClientFileUrl,
      generateJsClassicFilename,
    }),
    jsenvPluginAsJsClassicWorkers({
      generateJsClassicFilename,
    }),
  ]
}

// propagate ?as_js_classic to referenced urls
// and perform the conversion during fetchUrlContent
const jsenvPluginAsJsClassicConversion = ({
  systemJsInjection,
  systemJsClientFileUrl,
}) => {
  const propagateJsClassicSearchParam = (reference, context) => {
    const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl)
    if (
      !parentUrlInfo ||
      !new URL(parentUrlInfo.url).searchParams.has("as_js_classic")
    ) {
      return null
    }
    const urlTransformed = injectQueryParams(reference.url, {
      as_js_classic: "",
    })
    reference.filename = generateJsClassicFilename(reference.url)
    return urlTransformed
  }

  return {
    name: "jsenv:as_js_classic_conversion",
    appliesDuring: "*",
    redirectUrl: {
      // We want to propagate transformation of js module to js classic to:
      // - import specifier (static/dynamic import + re-export)
      // - url specifier when inside System.register/_context.import()
      //   (because it's the transpiled equivalent of static and dynamic imports)
      // And not other references otherwise we could try to transform inline resources
      // or specifiers inside new URL()...
      js_import_export: propagateJsClassicSearchParam,
      js_url_specifier: (reference, context) => {
        if (
          reference.subtype === "system_register_arg" ||
          reference.subtype === "system_import_arg"
        ) {
          return propagateJsClassicSearchParam(reference, context)
        }
        return null
      },
    },
    fetchUrlContent: async (urlInfo, context) => {
      const originalUrlInfo = await context.fetchOriginalUrlInfo({
        urlInfo,
        context,
        searchParam: "as_js_classic",
        // override the expectedType to "js_module"
        // because when there is ?as_js_classic it means the underlying resource
        // is a js_module
        expectedType: "js_module",
      })
      if (!originalUrlInfo) {
        return null
      }
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
        !originalUrlInfo.data.usesImport
          ? "umd"
          : "system"
      const { content, sourcemap } = await convertJsModuleToJsClassic({
        systemJsInjection,
        systemJsClientFileUrl,
        urlInfo,
        originalUrlInfo,
        jsClassicFormat,
      })
      urlInfo.data.jsClassicFormat = jsClassicFormat
      return {
        content,
        contentType: "text/javascript",
        type: "js_classic",
        originalUrl: originalUrlInfo.originalUrl,
        originalContent: originalUrlInfo.originalContent,
        sourcemap,
      }
    },
  }
}

const generateJsClassicFilename = (url) => {
  const filename = urlToFilename(url)
  let [basename, extension] = splitFileExtension(filename)
  const { searchParams } = new URL(url)
  if (
    searchParams.has("as_json_module") ||
    searchParams.has("as_css_module") ||
    searchParams.has("as_text_module")
  ) {
    extension = ".js"
  }
  return `${basename}.nomodule${extension}`
}

const splitFileExtension = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".")
  if (dotLastIndex === -1) {
    return [filename, ""]
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)]
}

const convertJsModuleToJsClassic = async ({
  systemJsInjection,
  systemJsClientFileUrl,
  urlInfo,
  originalUrlInfo,
  jsClassicFormat,
}) => {
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [
      ...(jsClassicFormat === "system"
        ? [
            // propposal-dynamic-import required with systemjs for babel8:
            // https://github.com/babel/babel/issues/10746
            requireFromJsenv("@babel/plugin-proposal-dynamic-import"),
            requireFromJsenv("@babel/plugin-transform-modules-systemjs"),
            [
              customAsyncToPromises,
              {
                topLevelAwait: "return",
              },
            ],
          ]
        : [
            [
              requireBabelPlugin("babel-plugin-transform-async-to-promises"),
              {
                topLevelAwait: "simple",
              },
            ],
            babelPluginTransformImportMetaUrl,
            requireFromJsenv("@babel/plugin-transform-modules-umd"),
          ]),
    ],
    urlInfo: originalUrlInfo,
  })
  let sourcemap = originalUrlInfo.sourcemap
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
