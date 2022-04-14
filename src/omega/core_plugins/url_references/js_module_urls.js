/*
 * TODO:
 * - si worker_type_module est pas supporté
 * et quon trouve type: 'module'
 * -> en faire un type: 'classic'
 * -> faire un truc dingue:
 *    - indiquer que la ressource est de type module (type: 'js_module')
 *    - indiquer que la ressource doit etre convertie en systemjs
 *    (a priori en injectant ?systemjs dans le specifier)
 * ça va poser souci pendant le build ça (on pourra plus versionner les urls)
 * donc on devrait ptet commencer par faire ça que pendant le build
 * et le faire post versioning (sauf que alors on auras pas le minify...)
 * donc plutot en amont puisque dans les workers on aura pas d'url?
 * ou si on a des urls on pourra encore les versioné puisqu'elle
 * seront dans des new URL() je dirais
 * par contre on aura pas les import nommé
 * donc je pense il faut viser simple:
 * la ressource sous-jacente on en fait un IIFE avec rollup et basta
 *
 * - parse navigator.serviceWorker.register and make it behave like new Worker()
 * - test code shared between worker and main with runtime not supporting type module
 * (code must be duplicated)
 */

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"

import {
  analyzeNewUrlCall,
  analyzeNewWorkerCall,
} from "./js_static_analysis.js"

export const parseAndTransformJsModuleUrls = async (urlInfo, context) => {
  const { rootDirectoryUrl, referenceUtils } = context

  const { metadata } = await applyBabelPlugins({
    babelPlugins: [
      babelPluginMetadataUrlMentions,
      babelPluginMetadataUsesTopLevelAwait,
    ],
    url: urlInfo.data.sourceUrl || urlInfo.url,
    generatedUrl: urlInfo.generatedUrl,
    content: urlInfo.content,
  })
  const { urlMentions, usesTopLevelAwait } = metadata
  urlInfo.data.usesTopLevelAwait = usesTopLevelAwait

  const actions = []
  const magicSource = createMagicSource(urlInfo.content)
  urlMentions.forEach((urlMention) => {
    const [reference, referencedUrlInfo] = referenceUtils.found({
      type: urlMention.type,
      subtype: urlMention.subtype,
      expectedType: urlMention.expectedType,
      expectedSubtype: urlMention.expectedSubtype,
      line: urlMention.line,
      column: urlMention.column,
      specifier: urlMention.specifier,
      data: urlMention.data,
      baseUrl: {
        "StringLiteral": urlMention.baseUrl,
        "window.origin": rootDirectoryUrl,
        "import.meta.url": urlInfo.url,
      }[urlMention.baseUrlType],
    })
    if (urlMention.expectedType) {
      referencedUrlInfo.type = urlMention.expectedType
    }
    if (urlMention.expectedSubtype) {
      referencedUrlInfo.subtype = urlMention.expectedSubtype
    }
    actions.push(async () => {
      magicSource.replace({
        start: urlMention.start,
        end: urlMention.end,
        replacement: await referenceUtils.readGeneratedSpecifier(reference),
      })
    })
  })
  await Promise.all(actions.map((action) => action()))
  return magicSource.toContentAndSourcemap()
}

/*
 * see also
 * https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md
 * https://github.com/mjackson/babel-plugin-import-visitor
 *
 */
const babelPluginMetadataUrlMentions = () => {
  return {
    name: "metadata-url-mentions",
    visitor: {
      Program(programPath, state) {
        const urlMentions = []
        const onSpecifier = ({
          type,
          subtype,
          specifierNode,
          expectedType,
          expectedSubtype,
          typeArgNode,
        }) => {
          urlMentions.push({
            type,
            subtype,
            specifier: specifierNode.value,
            expectedType,
            expectedSubtype,
            typeArgNode,
            ...getNodePosition(specifierNode),
          })
        }
        programPath.traverse({
          NewExpression: (path) => {
            const newWorkerReferenceInfos = analyzeNewWorkerCall(path)
            if (newWorkerReferenceInfos) {
              newWorkerReferenceInfos.forEach(onSpecifier)
              return
            }
            const newUrlReferenceInfos = analyzeNewUrlCall(path)
            if (newUrlReferenceInfos) {
              newUrlReferenceInfos.forEach(onSpecifier)
              return
            }
          },
          CallExpression: (path) => {
            if (path.node.callee.type !== "Import") {
              // Some other function call, not import();
              return
            }
            const specifierNode = path.node.arguments[0]
            if (specifierNode.type !== "StringLiteral") {
              // Non-string argument, probably a variable or expression, e.g.
              // import(moduleId)
              // import('./' + moduleName)
              return
            }
            onSpecifier({
              type: "js_import_export",
              subtype: "import_dynamic",
              specifierNode,
              path,
            })
          },
          ExportAllDeclaration: (path) => {
            const specifierNode = path.node.source
            onSpecifier({
              type: "js_import_export",
              subtype: "export_all",
              specifierNode,
              path,
            })
          },
          ExportNamedDeclaration: (path) => {
            const specifierNode = path.node.source
            if (!specifierNode) {
              // This export has no "source", so it's probably
              // a local variable or function, e.g.
              // export { varName }
              // export const constName = ...
              // export function funcName() {}
              return
            }
            onSpecifier({
              type: "js_import_export",
              subtype: "export_named",
              specifierNode,
              path,
            })
          },
          ImportDeclaration: (path) => {
            const specifierNode = path.node.source
            onSpecifier({
              type: "js_import_export",
              subtype: "import_static",
              specifierNode,
              path,
            })
          },
        })
        state.file.metadata.urlMentions = urlMentions
      },
    },
  }
}

const getNodePosition = (node) => {
  return {
    start: node.start,
    end: node.end,
    line: node.loc.start.line,
    column: node.loc.start.column,
    lineEnd: node.loc.end.line,
    columnEnd: node.loc.end.column,
  }
}

const babelPluginMetadataUsesTopLevelAwait = () => {
  return {
    name: "metadata-uses-top-level-await",
    visitor: {
      Program: (programPath, state) => {
        let usesTopLevelAwait = false
        programPath.traverse({
          AwaitExpression: (awaitPath) => {
            const closestFunction = awaitPath.getFunctionParent()
            if (!closestFunction) {
              usesTopLevelAwait = true
              awaitPath.stop()
            }
          },
        })
        state.file.metadata.usesTopLevelAwait = usesTopLevelAwait
      },
    },
  }
}
