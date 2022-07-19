import { getHtmlNodeAttribute } from "./html_node_attributes.js"

export const analyzeScriptNode = (scriptNode) => {
  const typeAttribute = getHtmlNodeAttribute(scriptNode, "type")
  if (typeAttribute === undefined || typeAttribute === "text/javascript") {
    return {
      type: "js_classic",
      contentType: "text/javascript",
    }
  }
  if (typeAttribute === "module") {
    return {
      type: "js_module",
      contentType: "text/javascript",
    }
  }
  if (typeAttribute === "importmap") {
    return {
      type: "importmap",
      contentType: "application/importmap+json",
    }
  }
  // jsx
  if (typeAttribute === "text/jsx") {
    return {
      type: "js_classic",
      contentType: "text/javascript",
      extension: ".jsx",
    }
  }
  if (typeAttribute === "module/jsx") {
    return {
      type: "js_module",
      contentType: "text/javascript",
      extension: ".jsx",
    }
  }
  // typescript
  if (typeAttribute === "text/ts") {
    return {
      type: "js_classic",
      contentType: "text/javascript",
      extension: ".ts",
    }
  }
  if (typeAttribute === "module/ts") {
    return {
      type: "js_module",
      contentType: "text/javascript",
      extension: ".ts",
    }
  }
  // typescript and jsx
  if (typeAttribute === "text/tsx") {
    return {
      type: "js_classic",
      contentType: "text/javascript",
      extension: ".tsx",
    }
  }
  if (typeAttribute === "module/tsx") {
    return {
      type: "js_module",
      contentType: "text/javascript",
      extension: ".tsx",
    }
  }
  // from MDN about [type] attribute:
  // "Any other value: The embedded content is treated as a data block
  // which won't be processed by the browser. Developers must use a valid MIME type
  // that is not a JavaScript MIME type to denote data blocks.
  // The src attribute will be ignored."
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-type
  return {
    type: "text",
    contentType: "text/plain",
  }
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
