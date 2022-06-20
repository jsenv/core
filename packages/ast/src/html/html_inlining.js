import {
  getAttributeByName,
  setAttributes,
  removeAttribute,
  removeAttributeByName,
} from "./html_attributes.js"
import { writeTextNode } from "./html_text_node.js"

export const inlineScript = (script, textContent) => {
  const srcAttribute = getAttributeByName(script, "src")
  setAttributes(script, {
    "generated-from-src": srcAttribute.value,
  })
  removeAttribute(script, srcAttribute)
  removeAttributeByName(script, "crossorigin")
  removeAttributeByName(script, "integrity")
  writeTextNode(script, textContent)
}

export const inlineLinkStylesheet = (link, textContent) => {
  const hrefAttribute = getAttributeByName(link, "href")
  setAttributes(link, {
    "generated-from-href": hrefAttribute.value,
  })
  removeAttribute(link, hrefAttribute)
  removeAttributeByName(link, "rel")
  removeAttributeByName(link, "type")
  removeAttributeByName(link, "as")
  removeAttributeByName(link, "crossorigin")
  removeAttributeByName(link, "integrity")
  link.nodeName = "style"
  link.tagName = "style"
  writeTextNode(link, textContent)
}

export const inlineImg = (img, contentAsBase64) => {
  const srcAttribute = getAttributeByName(img, "src")
  setAttributes(img, {
    "generated-from-src": srcAttribute.value,
    "src": contentAsBase64,
  })
}
