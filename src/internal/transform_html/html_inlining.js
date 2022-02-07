import {
  getHtmlNodeAttributeByName,
  removeHtmlNodeAttribute,
  removeHtmlNodeAttributeByName,
  assignHtmlNodeAttributes,
  setHtmlNodeText,
} from "./html_ast.js"

export const inlineScript = (script, textContent) => {
  const srcAttribute = getHtmlNodeAttributeByName(script, "src")
  assignHtmlNodeAttributes(script, "content-src", srcAttribute.value)
  removeHtmlNodeAttribute(script, srcAttribute)
  setHtmlNodeText(script, textContent)

  removeHtmlNodeAttributeByName(script, "crossorigin")
  removeHtmlNodeAttributeByName(script, "integrity")
}

export const inlineLinkStylesheet = (link, textContent) => {
  const hrefAttribute = getHtmlNodeAttributeByName(link, "href")
  assignHtmlNodeAttributes(link, "content-href", hrefAttribute.value)
  removeHtmlNodeAttribute(link, hrefAttribute)
  removeHtmlNodeAttributeByName(link, "rel")
  removeHtmlNodeAttributeByName(link, "type")
  removeHtmlNodeAttributeByName(link, "as")
  removeHtmlNodeAttributeByName(link, "crossorigin")
  removeHtmlNodeAttributeByName(link, "integrity")
  link.nodeName = "style"
  setHtmlNodeText(link, textContent)
}

export const inlineImg = (img, contentAsBase64) => {
  const srcAttribute = getHtmlNodeAttributeByName(img, "src")
  assignHtmlNodeAttributes(img, "content-src", srcAttribute.value)
  srcAttribute.value = contentAsBase64
}
