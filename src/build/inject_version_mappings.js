// https://bundlers.tooling.report/hashing/avoid-cascade/

import {
  parseHtmlString,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
  stringifyHtmlAst,
} from "@jsenv/utils/html_ast/html_ast.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"

import { updateContentAndSourcemap } from "./update_content_and_sourcemap.js"

export const injectVersionMappings = async (
  urlInfo,
  { rootDirectoryUrl, versionMappings },
) => {
  const injector = injectors[urlInfo.type]
  if (injector) {
    const { content, sourcemap } = injector(urlInfo, { versionMappings })
    await updateContentAndSourcemap(urlInfo, {
      rootDirectoryUrl,
      content,
      sourcemap,
    })
  }
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
  js_module: (urlInfo, { versionMappings }) => {
    const magicSource = createMagicSource(urlInfo.content)
    magicSource.prepend(generateClientCodeForVersionMappings(versionMappings))
    return magicSource.toContentAndSourcemap()
  },
}

const generateClientCodeForVersionMappings = (versionMappings) => {
  return `
var __versionMappings__ = ${JSON.stringify(versionMappings, null, "  ")}
var __envGlobal__ = typeof self === 'undefined' ? global : self
__envGlobal__.__v__ = function (specifier) {
  return __versionMappings__[specifier] || specifier
}
`
}
