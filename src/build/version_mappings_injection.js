// https://bundlers.tooling.report/hashing/avoid-cascade/

import { createMagicSource } from "@jsenv/sourcemap"
import {
  parseHtmlString,
  injectScriptNodeAsEarlyAsPossible,
  createHtmlNode,
  stringifyHtmlAst,
} from "@jsenv/ast"

import { isWebWorkerUrlInfo } from "@jsenv/core/src/kitchen/web_workers.js"

export const injectVersionMappingsAsGlobal = async ({
  urlInfo,
  kitchen,
  versionMappings,
}) => {
  const injector = injectors[urlInfo.type]
  if (injector) {
    const { content, sourcemap } = await injector(urlInfo, {
      versionMappings,
      minification: kitchen.kitchenContext.minification,
    })
    kitchen.urlInfoTransformer.applyFinalTransformations(urlInfo, {
      content,
      sourcemap,
    })
  }
}
const injectors = {
  html: (urlInfo, { versionMappings, minification }) => {
    const htmlAst = parseHtmlString(urlInfo.content, {
      storeOriginalPositions: false,
    })
    injectScriptNodeAsEarlyAsPossible(
      htmlAst,
      createHtmlNode({
        tagName: "script",
        textContent: generateClientCodeForVersionMappings(versionMappings, {
          globalName: "window",
          minification,
        }),
      }),
      "jsenv:versioning",
    )
    return {
      content: stringifyHtmlAst(htmlAst),
    }
  },
  js_classic: (...args) => jsInjector(...args),
  js_module: (...args) => jsInjector(...args),
}
const jsInjector = (urlInfo, { versionMappings, minification }) => {
  const magicSource = createMagicSource(urlInfo.content)
  magicSource.prepend(
    generateClientCodeForVersionMappings(versionMappings, {
      globalName: isWebWorkerUrlInfo(urlInfo) ? "self" : "window",
      minification,
    }),
  )
  return magicSource.toContentAndSourcemap()
}
const generateClientCodeForVersionMappings = (
  versionMappings,
  { globalName, minification },
) => {
  if (minification) {
    return `;(function(){var m = ${JSON.stringify(
      versionMappings,
    )}; ${globalName}.__v__ = function (s) { return m[s] || s }; })();`
  }
  return `;(function() {
  var __versionMappings__ = ${JSON.stringify(versionMappings, null, "  ")};
  ${globalName}.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier
  };
})();`
}

export const injectVersionMappingsAsImportmap = async ({
  urlInfo,
  kitchen,
  versionMappings,
}) => {
  const htmlAst = parseHtmlString(urlInfo.content, {
    storeOriginalPositions: false,
  })
  // jsenv_plugin_importmap.js is removing importmap during build
  // it means at this point we know HTML has no importmap in it
  // we can safely inject one
  const importmapNode = createHtmlNode({
    tagName: "script",
    type: "importmap",
    textContent: kitchen.kitchenContext.minification
      ? JSON.stringify({ imports: versionMappings })
      : `  
      {
        "imports": {${JSON.stringify(versionMappings, null, "          ").slice(
          1,
          -1,
        )}        }
      }
    `,
  })
  injectScriptNodeAsEarlyAsPossible(htmlAst, importmapNode, "jsenv:versioning")
  kitchen.urlInfoTransformer.applyFinalTransformations(urlInfo, {
    content: stringifyHtmlAst(htmlAst),
  })
}
