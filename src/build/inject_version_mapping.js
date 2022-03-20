// https://bundlers.tooling.report/hashing/avoid-cascade/

import {
  parseHtmlString,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
  stringifyHtmlAst,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"
import { createMagicSource } from "@jsenv/core/src/utils/sourcemap/magic_source.js"

import { updateContentAndSourcemap } from "./update_content_and_sourcemap.js"

export const injectVersionMapping = (
  urlInfo,
  { versionMappings, sourcemapMethod },
) => {
  const injector = injectors[urlInfo.type]
  if (injector) {
    const { content, sourcemap } = injector(urlInfo, { versionMappings })
    updateContentAndSourcemap(urlInfo, {
      content,
      sourcemap,
      sourcemapMethod,
    })
  }
}

const injectors = {
  html: (urlInfo, { versionMappings }) => {
    const htmlAst = parseHtmlString(urlInfo.content, {
      storeOriginalPositions: false,
    })
    injectScriptAsEarlyAsPossible(
      htmlAst,
      createHtmlNode({
        tagName: "script",
        textContent: generateClientCodeForVersionMappings(versionMappings),
      }),
    )
    return {
      content: stringifyHtmlAst(htmlAst),
    }
  },
  js_module: (urlInfo, { versionMappings }) => {
    const magicSource = createMagicSource({
      url: urlInfo.url,
      content: urlInfo.content,
    })
    magicSource.prepend(generateClientCodeForVersionMappings(versionMappings))
    return magicSource.toContentAndSourcemap()
  },
}

const generateClientCodeForVersionMappings = (versionMappings) => {
  return `
var __versionMappings__ = ${JSON.stringify(versionMappings)}
self.__asVersionedSpecifier__ = function (specifier) {
  return __versionMappings__[specifier] || specifier
}
`
}
