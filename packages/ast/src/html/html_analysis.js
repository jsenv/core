import { getHtmlNodeAttribute } from "./html_node_attributes.js"

export const analyzeScriptNode = (scriptNode) => {
  const type = getHtmlNodeAttribute(scriptNode, "type")
  if (type === undefined || type === "text/javascript") {
    return "classic"
  }
  if (type === "module") {
    return "module"
  }
  if (type === "importmap") {
    return "importmap"
  }
  return type
}

export const analyzeLinkNode = (linkNode) => {
  const rel = getHtmlNodeAttribute(linkNode, "rel")
  if (rel === "stylesheet") {
    return {
      isStylesheet: true,
    }
  }
  const isRessourceHint = [
    "preconnect",
    "dns-prefetch",
    "prefetch",
    "preload",
    "modulepreload",
  ].includes(rel)
  return {
    isRessourceHint,
    rel,
  }
}
