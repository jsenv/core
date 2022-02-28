import {
  parseHtmlString,
  parseLinkNode,
  getHtmlNodeAttributeByName,
  stringifyHtmlAst,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { htmlAttributeSrcSet } from "@jsenv/core/src/internal/transform_html/html_attribute_src_set.js"

export const parseHtmlUrlMentions = ({ url, contentType, content }) => {
  if (contentType !== "text/html") {
    return null
  }
  const htmlAst = parseHtmlString(content)
  const htmlUrlMentions = collectHtmlUrlMentions({ url, htmlAst })
  return {
    urlMentions: htmlUrlMentions,
    getHotInfo: () => {
      const hotAcceptDependencies = []
      htmlUrlMentions.forEach(({ url, hotAccepted }) => {
        // Adding url to "hotAcceptDependencies" means html hot_reload these ressources:
        // something like this: link.href = `${link.href}?hmr=${Date.now()}`)
        // If some url must trigger a full reload of the html page it should be excluded from
        // "hotAcceptDependencies".
        // There is some "smart" default applied in "collectHtmlDependenciesFromAst"
        // to decide what should hot reload / fullreload:
        // By default:
        //   - hot reload on <img src="./image.png" />
        //   - fullreload on <script src="./file.js" />
        // Can be controlled by [hot-decline] and [hot-accept]:
        //   - fullreload on <img src="./image.png" hot-decline />
        //   - hot reload on <script src="./file.js" hot-accept />
        if (hotAccepted) {
          hotAcceptDependencies.push(url)
        }
      })
      return {
        hotAcceptSelf: false,
        hotAcceptDependencies,
      }
    },
    transformUrlMentions: ({ transformUrlMention }) => {
      htmlUrlMentions.forEach((htmlUrlMention) => {
        htmlUrlMention.attribute.value = transformUrlMention(htmlUrlMention)
      })
      return {
        content: stringifyHtmlAst(htmlAst),
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
    htmlUrlMentions.push({
      type,
      htmlNode: node,
      attribute,
      specifier,
      hotAccepted,
    })
  }
  const onNode = (node, { hotAccepted }) => {
    if (node.nodeName === "link") {
      if (hotAccepted === undefined) {
        const { isStylesheet, isRessourceHint } = parseLinkNode(node)
        if (isStylesheet) {
          // stylesheets can be hot replaced by default
          hotAccepted = true
        } else if (isRessourceHint) {
          // for ressource hints html will be notified the underlying ressource has changed
          // but we won't do anything (if the ressource is deleted we should?)
          hotAccepted = true
        }
      }
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
        hotAccepted:
          hotAccepted === undefined
            ? // script cannot hotreload by default
              false
            : hotAccepted,
      })
      return
    }
    if (node.nodeName === "a") {
      visitAttributeAsUrlSpecifier({
        type: "a_href",
        node,
        attributeName: "href",
        hotAccepted: hotAccepted === undefined ? true : hotAccepted,
      })
    }
    if (node.nodeName === "iframe") {
      // Iframe will have their own event source client
      // and can hot reload independently
      // But if the iframe communicates with the parent iframe
      // then we canot know for sure if the communication is broken
      // ideally, if the iframe full-reload the page must full-reload too
      // if the iframe hot-reload we don't know but we could assume there is nothing to do
      // if there is [hot-accept] on the iframe
      visitAttributeAsUrlSpecifier({
        type: "iframe_src",
        node,
        attributeName: "src",
        hotAccepted: hotAccepted === undefined ? false : hotAccepted,
      })
    }
    if (node.nodeName === "img") {
      visitAttributeAsUrlSpecifier({
        type: "img_src",
        node,
        attributeName: "src",
        hotAccepted: hotAccepted === undefined ? true : hotAccepted,
      })
      visitSrcset({
        type: "img_srcset",
        node,
        hotAccepted: hotAccepted === undefined ? true : hotAccepted,
      })
      return
    }
    if (node.nodeName === "source") {
      visitAttributeAsUrlSpecifier({
        type: "source_src",
        node,
        attributeName: "src",
        hotAccepted: hotAccepted === undefined ? true : hotAccepted,
      })
      visitSrcset({
        type: "source_srcset",
        node,
        hotAccepted: hotAccepted === undefined ? true : hotAccepted,
      })
      return
    }
    // svg <image> tag
    if (node.nodeName === "image") {
      visitAttributeAsUrlSpecifier({
        type: "image_href",
        node,
        attributeName: "href",
        hotAccepted: hotAccepted === undefined ? true : hotAccepted,
      })
      return
    }
    if (node.nodeName === "use") {
      visitAttributeAsUrlSpecifier({
        type: "use_href",
        node,
        attributeName: "href",
        hotAccepted: hotAccepted === undefined ? true : hotAccepted,
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
