// https://bundlers.tooling.report/hashing/avoid-cascade/

import { createMagicSource } from "@jsenv/sourcemap"
import {
  parseHtmlString,
  injectScriptNodeAsEarlyAsPossible,
  createHtmlNode,
  stringifyHtmlAst,
} from "@jsenv/ast"

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
  magicSource.prepend(
    generateClientCodeForVersionMappings(versionMappings, {
      globalName: urlInfo.data.isWebWorkerEntryPoint ? "self" : "window",
    }),
  )
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
    injectScriptNodeAsEarlyAsPossible(
      htmlAst,
      createHtmlNode({
        "tagName": "script",
        "textContent": generateClientCodeForVersionMappings(versionMappings, {
          globalName: "window",
        }),
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

const generateClientCodeForVersionMappings = (
  versionMappings,
  { globalName },
) => {
  return `
;(function() {

var __versionMappings__ = ${JSON.stringify(versionMappings, null, "  ")};
${globalName}.__v__ = function (specifier) {
  return __versionMappings__[specifier] || specifier
};

})();

`
}
