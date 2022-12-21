import { createMagicSource } from "@jsenv/sourcemap"
import {
  parseHtmlString,
  injectScriptNodeAsEarlyAsPossible,
  createHtmlNode,
  stringifyHtmlAst,
} from "@jsenv/ast"

export const injectGlobals = (urlInfo, globals) => {
  if (urlInfo.type === "html") {
    return globalInjectorOnHtml(urlInfo, globals)
  }
  if (urlInfo.type === "js_classic" || urlInfo.type === "js_module") {
    return globalsInjectorOnJs(urlInfo, globals)
  }
  throw new Error(`cannot inject globals into "${urlInfo.type}"`)
}

const globalInjectorOnHtml = async (urlInfo, globals) => {
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
  injectScriptNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      textContent: clientCode,
    }),
    "jsenv:inject_globals",
  )
  return stringifyHtmlAst(htmlAst)
}

const globalsInjectorOnJs = async (urlInfo, globals) => {
  const clientCode = generateClientCodeForGlobals({
    globals,
    isWebWorker:
      urlInfo.subtype === "worker" ||
      urlInfo.subtype === "service_worker" ||
      urlInfo.subtype === "shared_worker",
  })
  const magicSource = createMagicSource(urlInfo.content)
  magicSource.prepend(clientCode)
  return magicSource.toContentAndSourcemap()
}

const generateClientCodeForGlobals = ({ isWebWorker = false, globals }) => {
  const globalName = isWebWorker ? "self" : "window"
  return `Object.assign(${globalName}, ${JSON.stringify(globals, null, "  ")});`
}
