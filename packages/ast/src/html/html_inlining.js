import {
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
} from "./html_node_attributes.js"
import { setHtmlNodeText } from "./html_node_text.js"

export const inlineScriptNode = (script, textContent) => {
  const src = getHtmlNodeAttribute(script, "src")
  setHtmlNodeAttributes(script, {
    "generated-from-src": src,
    "src": undefined,
    "crossorigin": undefined,
    "integrity": undefined,
  })
  setHtmlNodeText(script, textContent)
}

export const inlineLinkStylesheetNode = (link, textContent) => {
  const href = getHtmlNodeAttribute(link, "href")
  setHtmlNodeAttributes(link, {
    "generated-from-href": href,
    "href": undefined,
    "rel": undefined,
    "type": undefined,
    "as": undefined,
    "crossorigin": undefined,
    "integrity": undefined,
  })
  link.nodeName = "style"
  link.tagName = "style"
  setHtmlNodeText(link, textContent)
}

export const inlineImgNode = (img, contentAsBase64) => {
  const src = getHtmlNodeAttribute(img, "src")
  setHtmlNodeAttributes(img, {
    "generated-from-src": src,
    "src": contentAsBase64,
  })
}
