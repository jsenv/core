import { getAttributeByName } from "./html_attributes.js"

export const analyzeScriptNode = (scriptNode) => {
  const typeAttribute = getAttributeByName(scriptNode, "type")
  if (!typeAttribute) {
    return "classic"
  }
  if (
    typeAttribute.value === "text/javascript" ||
    typeAttribute.value === "text/javascript"
  ) {
    return "classic"
  }
  if (typeAttribute.value === "module") {
    return "module"
  }
  if (typeAttribute.value === "importmap") {
    return "importmap"
  }
  return typeAttribute.value
}

export const analyzeLinkNode = (linkNode) => {
  const relAttr = getAttributeByName(linkNode, "rel")
  const rel = relAttr ? relAttr.value : undefined
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
