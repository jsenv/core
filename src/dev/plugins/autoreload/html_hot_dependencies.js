import {
  getHtmlNodeAttributeByName,
  parseLinkNode,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"
import { htmlAttributeSrcSet } from "@jsenv/core/src/utils/html_ast/html_attribute_src_set.js"

// Some "smart" default applied to decide what should hot reload / fullreload:
// By default:
//   - hot reload on <img src="./image.png" />
//   - fullreload on <script src="./file.js" />
// Can be controlled by [hot-decline] and [hot-accept]:
//   - fullreload on <img src="./image.png" hot-decline />
//   - hot reload on <script src="./file.js" hot-accept />
export const collectHotDataFromHtmlAst = (htmlAst) => {
  const hotReferences = []

  const onSpecifier = ({ specifier, node, attributeName, hotAccepted }) => {
    if (
      // explicitely enabled with [hot-accept] attribute
      hotAccepted === true ||
      htmlNodeCanHotReload(node)
    ) {
      hotReferences.push({
        type: `${node.nodeName}_${attributeName}`,
        specifier,
      })
    }
  }

  const visitUrlSpecifierAttribute = ({ node, attributeName, hotAccepted }) => {
    const attribute = getHtmlNodeAttributeByName(node, attributeName)
    const value = attribute ? attribute.value : undefined
    if (value) {
      onSpecifier({
        specifier: value,
        node,
        attributeName,
        hotAccepted,
      })
    }
  }

  const onNode = (node, { hotAccepted }) => {
    // explicitely disabled with [hot-decline] attribute
    if (hotAccepted === false) {
      return
    }
    if (nodeNamesWithHref.includes(node.nodeName)) {
      visitUrlSpecifierAttribute({
        node,
        attributeName: "href",
        hotAccepted,
      })
      visitUrlSpecifierAttribute({
        node,
        attributeName: "content-href",
        hotAccepted,
      })
    }
    if (nodeNamesWithSrc.includes(node.nodeName)) {
      visitUrlSpecifierAttribute({
        node,
        attributeName: "src",
        hotAccepted,
      })
      visitUrlSpecifierAttribute({
        node,
        attributeName: "content-src",
        hotAccepted,
      })
    }
    if (nodeNamesWithSrcset.includes(node.nodeName)) {
      const srcsetAttribute = getHtmlNodeAttributeByName(node, "srcset")
      const srcset = srcsetAttribute ? srcsetAttribute.value : undefined
      if (srcset) {
        const srcCandidates = htmlAttributeSrcSet.parse(srcset)
        srcCandidates.forEach((srcCandidate) => {
          onSpecifier({
            node,
            specifier: srcCandidate.specifier,
            attributeName: "srcset",
            hotAccepted,
          })
        })
      }
    }
  }

  const iterate = (node, context) => {
    context = {
      ...context,
      ...getNodeContext(node),
    }
    onNode(node, context)
    const { childNodes } = node
    if (childNodes) {
      let i = 0
      while (i < childNodes.length) {
        const childNode = childNodes[i++]
        iterate(childNode, context)
      }
    }
  }
  iterate(htmlAst, {})

  return { hotReferences }
}

const nodeNamesWithHref = ["link", "a", "image", "use"]
const nodeNamesWithSrc = ["script", "iframe", "img"]
const nodeNamesWithSrcset = ["img", "source"]

const getNodeContext = (node) => {
  const context = {}
  const hotAcceptAttribute = getHtmlNodeAttributeByName(node, "hot-accept")
  if (hotAcceptAttribute) {
    context.hotAccepted = true
  }
  const hotDeclineAttribute = getHtmlNodeAttributeByName(node, "hot-decline")
  if (hotDeclineAttribute) {
    context.hotAccepted = false
  }
  return context
}

const htmlNodeCanHotReload = (node) => {
  if (node.nodeName === "link") {
    const { isStylesheet, isRessourceHint } = parseLinkNode(node)
    if (isStylesheet) {
      // stylesheets can be hot replaced by default
      return true
    }
    if (isRessourceHint) {
      // for ressource hints html will be notified the underlying ressource has changed
      // but we won't do anything (if the ressource is deleted we should?)
      return true
    }
    return false
  }
  return [
    // "script_src", // script src cannot hot reload
    "a",
    // Iframe will have their own event source client
    // and can hot reload independently
    // But if the iframe communicates with the parent iframe
    // then we canot know for sure if the communication is broken
    // ideally, if the iframe full-reload the page must full-reload too
    // if the iframe hot-reload we don't know but we could assume there is nothing to do
    // if there is [hot-accept] on the iframe
    "iframe",
    "img",
    "source",
    "image",
    "use",
  ].includes(node.nodeName)
}
