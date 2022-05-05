// https://bundlers.tooling.report/hashing/avoid-cascade/

import {
  parseHtmlString,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
  stringifyHtmlAst,
} from "@jsenv/utils/html_ast/html_ast.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"

import { GRAPH } from "./graph_utils.js"

export const injectGlobalVersionMapping = async ({
  finalGraphKitchen,
  finalGraph,
  versionMappings,
}) => {
  await Promise.all(
    GRAPH.map(finalGraph, async (urlInfo) => {
      if (urlInfo.data.isEntryPoint || urlInfo.data.isWebWorkerEntryPoint) {
        await injectVersionMappings({
          urlInfo,
          kitchen: finalGraphKitchen,
          versionMappings,
        })
      }
    }),
  )
}

const injectVersionMappings = async ({ urlInfo, kitchen, versionMappings }) => {
  const injector = injectors[urlInfo.type]
  if (injector) {
    const { content, sourcemap } = injector(urlInfo, { versionMappings })
    await kitchen.urlInfoTransformer.applyFinalTransformations(urlInfo, {
      content,
      sourcemap,
    })
  }
}

const jsInjector = (urlInfo, { versionMappings }) => {
  const magicSource = createMagicSource(urlInfo.content)
  magicSource.prepend(generateClientCodeForVersionMappings(versionMappings))
  return magicSource.toContentAndSourcemap()
}

const injectors = {
  html: (urlInfo, { versionMappings }) => {
    // ideally we would inject an importmap but browser support is too low
    // (even worse for worker/service worker)
    // so for now we inject code into entry points
    const htmlAst = parseHtmlString(urlInfo.content, {
      storeOriginalPositions: false,
    })
    injectScriptAsEarlyAsPossible(
      htmlAst,
      createHtmlNode({
        "tagName": "script",
        "textContent": generateClientCodeForVersionMappings(versionMappings),
        "injected-by": "jsenv:versioning",
      }),
    )
    return {
      content: stringifyHtmlAst(htmlAst),
    }
  },
  js_classic: jsInjector,
  js_module: jsInjector,
}

const generateClientCodeForVersionMappings = (versionMappings) => {
  return `
var __versionMappings__ = ${JSON.stringify(versionMappings, null, "  ")};
var __envGlobal__ = typeof self === 'undefined' ? global : self;
__envGlobal__.__v__ = function (specifier) {
  return __versionMappings__[specifier] || specifier
};
`
}
