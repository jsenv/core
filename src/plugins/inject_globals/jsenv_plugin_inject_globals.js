import {
  parseHtmlString,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
  stringifyHtmlAst,
} from "@jsenv/utils/html_ast/html_ast.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { isWebWorkerUrlInfo } from "@jsenv/core/src/omega/web_workers.js"

export const jsenvPluginInjectGlobals = (globals = {}) => {
  if (Object.keys(globals).length === 0) {
    return []
  }

  const globalInjectorOnHtmlEntryPoint = (urlInfo) => {
    if (!urlInfo.data.isEntryPoint) {
      return null
    }
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
        "textContent": generateClientCodeForGlobals({
          globals,
          isWebWorker: false,
        }),
        "injected-by": "jsenv:inject_globals",
      }),
    )
    return stringifyHtmlAst(htmlAst)
  }

  const globalsInjectorOnJsEntryPoints = (urlInfo) => {
    if (!urlInfo.data.isEntryPoint && !urlInfo.data.isWebWorkerEntryPoint) {
      return null
    }
    const magicSource = createMagicSource(urlInfo.content)
    magicSource.append(
      generateClientCodeForGlobals({
        globals,
        isWebWorker: isWebWorkerUrlInfo(urlInfo),
      }),
    )
    return magicSource.toContentAndSourcemap()
  }

  return {
    name: "jsenv:inject_globals",
    appliesDuring: "*",
    transformUrlContent: {
      html: globalInjectorOnHtmlEntryPoint,
      js_classic: globalsInjectorOnJsEntryPoints,
      js_module: globalsInjectorOnJsEntryPoints,
    },
  }
}

const generateClientCodeForGlobals = ({ isWebWorker = false, globals }) => {
  const globalName = isWebWorker ? "self" : "window"
  return `Object.assign(${globalName}, ${JSON.stringify(globals, null, "  ")});`
}
