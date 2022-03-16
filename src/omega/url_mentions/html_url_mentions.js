import {
  parseHtmlString,
  stringifyHtmlAst,
  getHtmlNodeAttributeByName,
  htmlNodePosition,
  parseLinkNode,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"
import { htmlAttributeSrcSet } from "@jsenv/core/src/utils/html_ast/html_attribute_src_set.js"

export const parseHtmlUrlMentions = ({ url, content }) => {
  const htmlAst = parseHtmlString(content)
  const htmlUrlMentions = collectHtmlUrlMentions({ url, htmlAst })
  return {
    urlMentions: htmlUrlMentions,
    replaceUrls: (replacements) => {
      replacements.forEach(({ urlMentionIndex, value }) => {
        const urlMention = htmlUrlMentions[urlMentionIndex]
        urlMention.attribute.value = value
      })
      return {
        content: stringifyHtmlAst(htmlAst, {
          removeOriginalPositionAttributes: true,
        }),
      }
    },
  }
}

const collectHtmlUrlMentions = ({ url, htmlAst }) => {
  const htmlUrlMentions = []
  const addDependency = ({ type, node, attribute, specifier, hotAccepted }) => {
    // ignore local url specifier (<use href="#logo"> or <a href="#">)
    if (specifier[0] === "#") {
      return
    }
    const injected = Boolean(getHtmlNodeAttributeByName(node, "data-injected"))
    const externalized = Boolean(
      getHtmlNodeAttributeByName(node, "data-externalized"),
    )

    let position
    if (externalized) {
      // when externalized, the real line, column is not the content-src but the original-position
      position = htmlNodePosition.readNodePosition(node)
    } else {
      position = htmlNodePosition.readAttributePosition(node, attribute.name)
    }
    const { line, column, originalLine, originalColumn } = position

    htmlUrlMentions.push({
      type,
      htmlNode: node,
      attribute,
      injected,
      externalized,
      specifier,
      hotAccepted:
        hotAccepted === undefined
          ? htmlReferenceAcceptsHotByDefault({ node })
          : hotAccepted,
      line,
      column,
      originalLine,
      originalColumn,
    })
  }
  const onNode = (node, { hotAccepted }) => {
    if (node.nodeName === "link") {
      visitAttributeAsUrlSpecifier({
        type: "link_href",
        node,
        attributeName: "href",
        hotAccepted,
      })
      return
    }
    // if (node.nodeName === "style") {
    //   // styles.push(node)
    //   return
    // }
    if (node.nodeName === "script") {
      visitAttributeAsUrlSpecifier({
        type: "script_src",
        node,
        attributeName: "src",
        hotAccepted,
      })
      return
    }
    if (node.nodeName === "a") {
      visitAttributeAsUrlSpecifier({
        type: "a_href",
        node,
        attributeName: "href",
        hotAccepted,
      })
    }
    if (node.nodeName === "iframe") {
      visitAttributeAsUrlSpecifier({
        type: "iframe_src",
        node,
        attributeName: "src",
        hotAccepted,
      })
    }
    if (node.nodeName === "img") {
      visitAttributeAsUrlSpecifier({
        type: "img_src",
        node,
        attributeName: "src",
        hotAccepted,
      })
      visitSrcset({
        type: "img_srcset",
        node,
        hotAccepted,
      })
      return
    }
    if (node.nodeName === "source") {
      visitAttributeAsUrlSpecifier({
        type: "source_src",
        node,
        attributeName: "src",
        hotAccepted,
      })
      visitSrcset({
        type: "source_srcset",
        node,
        hotAccepted,
      })
      return
    }
    // svg <image> tag
    if (node.nodeName === "image") {
      visitAttributeAsUrlSpecifier({
        type: "image_href",
        node,
        attributeName: "href",
        hotAccepted,
      })
      return
    }
    if (node.nodeName === "use") {
      visitAttributeAsUrlSpecifier({
        type: "use_href",
        node,
        attributeName: "href",
        hotAccepted,
      })
      return
    }
  }
  const visitAttributeAsUrlSpecifier = ({
    type,
    node,
    attributeName,
    hotAccepted,
  }) => {
    const attribute = getHtmlNodeAttributeByName(node, attributeName)
    const value = attribute ? attribute.value : undefined
    if (value) {
      addDependency({
        type,
        node,
        attribute,
        specifier:
          attributeName === "content-src" ? new URL(value, url).href : value,
        hotAccepted,
      })
    } else if (attributeName === "src") {
      visitAttributeAsUrlSpecifier({
        type,
        node,
        attributeName: "content-src",
        hotAccepted,
      })
    } else if (attributeName === "href") {
      visitAttributeAsUrlSpecifier({
        type,
        node,
        attributeName: "content-href",
        hotAccepted,
      })
    }
  }
  const visitSrcset = ({ type, node, hotAccepted }) => {
    const srcsetAttribute = getHtmlNodeAttributeByName(node, "srcset")
    const srcset = srcsetAttribute ? srcsetAttribute.value : undefined
    if (srcset) {
      const srcCandidates = htmlAttributeSrcSet.parse(srcset)
      srcCandidates.forEach((srcCandidate) => {
        addDependency({
          type,
          node,
          attribute: srcsetAttribute,
          specifier: srcCandidate.specifier,
          hotAccepted,
        })
      })
    }
  }
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
  return htmlUrlMentions
}

const htmlReferenceAcceptsHotByDefault = ({ type, node }) => {
  if (type === "link_href") {
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
    "a_href",
    // Iframe will have their own event source client
    // and can hot reload independently
    // But if the iframe communicates with the parent iframe
    // then we canot know for sure if the communication is broken
    // ideally, if the iframe full-reload the page must full-reload too
    // if the iframe hot-reload we don't know but we could assume there is nothing to do
    // if there is [hot-accept] on the iframe
    "iframe_src",
    "img_src",
    "img_srcset",
    "source_src",
    "source_srcset",
    "image_href",
    "use_href",
  ].includes(type)
}
