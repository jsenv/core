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
  return {
    name: "jsenv:inject_globals",
    appliesDuring: "*",
    transformUrlContent: {
      html: injectGlobals,
      js_classic: injectGlobals,
      js_module: injectGlobals,
    },
  }
}

export const injectGlobals = (urlInfo, globals) => {
  if (urlInfo.type === "html") {
    return globalInjectorOnHtmlEntryPoint(urlInfo, globals)
  }
  if (urlInfo.type === "js_classic" || urlInfo.type === "js_module") {
    return globalsInjectorOnJsEntryPoints(urlInfo, globals)
  }
  throw new Error(`cannot inject globals into "${urlInfo.type}"`)
}

const globalInjectorOnHtmlEntryPoint = async (urlInfo, globals) => {
  if (!urlInfo.data.isEntryPoint) {
    return null
  }
  // ideally we would inject an importmap but browser support is too low
  // (even worse for worker/service worker)
  // so for now we inject code into entry points
  const htmlAst = parseHtmlString(urlInfo.content, {
    storeOriginalPositions: false,
  })
  const clientCode = generateClientCodeForGlobals({
    globals,
    isWebWorker: false,
  })
  injectScriptAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      "tagName": "script",
      "textContent": clientCode,
      "injected-by": "jsenv:inject_globals",
    }),
  )
  return stringifyHtmlAst(htmlAst)
}

const globalsInjectorOnJsEntryPoints = async (urlInfo, globals) => {
  if (!urlInfo.data.isEntryPoint && !urlInfo.data.isWebWorkerEntryPoint) {
    return null
  }
  const clientCode = generateClientCodeForGlobals({
    globals,
    isWebWorker: isWebWorkerUrlInfo(urlInfo),
  })
  const magicSource = createMagicSource(urlInfo.content)
  magicSource.prepend(clientCode)
  return magicSource.toContentAndSourcemap()
}

const generateClientCodeForGlobals = ({ isWebWorker = false, globals }) => {
  const globalName = isWebWorker ? "self" : "window"
  return `Object.assign(${globalName}, ${JSON.stringify(globals, null, "  ")});`
}
