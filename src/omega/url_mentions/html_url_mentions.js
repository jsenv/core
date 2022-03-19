import {
  parseHtmlString,
  stringifyHtmlAst,
  getHtmlNodeAttributeByName,
  htmlNodePosition,
  visitHtmlAst,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"
import { htmlAttributeSrcSet } from "@jsenv/core/src/utils/html_ast/html_attribute_src_set.js"

export const parseHtmlUrlMentions = ({ url, content }) => {
  const htmlAst = parseHtmlString(content, { storeOriginalPositions: true })
  const htmlUrlMentions = collectHtmlUrlMentions({ url, htmlAst })
  return {
    urlMentions: htmlUrlMentions,
    replaceUrls: (getReplacement) => {
      htmlUrlMentions.forEach((urlMention) => {
        const replacement = getReplacement(urlMention)
        if (replacement) {
          urlMention.attribute.value = replacement
        }
      })
      return {
        content: stringifyHtmlAst(htmlAst),
      }
    },
  }
}

const collectHtmlUrlMentions = ({ url, htmlAst }) => {
  const htmlUrlMentions = []
  const addDependency = ({ type, node, attribute, specifier }) => {
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
      line,
      column,
      originalLine,
      originalColumn,
    })
  }
  const onNode = (node) => {
    if (node.nodeName === "link") {
      visitAttributeAsUrlSpecifier({
        type: "link_href",
        node,
        attributeName: "href",
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
      })
      return
    }
    if (node.nodeName === "a") {
      visitAttributeAsUrlSpecifier({
        type: "a_href",
        node,
        attributeName: "href",
      })
    }
    if (node.nodeName === "iframe") {
      visitAttributeAsUrlSpecifier({
        type: "iframe_src",
        node,
        attributeName: "src",
      })
    }
    if (node.nodeName === "img") {
      visitAttributeAsUrlSpecifier({
        type: "img_src",
        node,
        attributeName: "src",
      })
      visitSrcset({
        type: "img_srcset",
        node,
      })
      return
    }
    if (node.nodeName === "source") {
      visitAttributeAsUrlSpecifier({
        type: "source_src",
        node,
        attributeName: "src",
      })
      visitSrcset({
        type: "source_srcset",
        node,
      })
      return
    }
    // svg <image> tag
    if (node.nodeName === "image") {
      visitAttributeAsUrlSpecifier({
        type: "image_href",
        node,
        attributeName: "href",
      })
      return
    }
    if (node.nodeName === "use") {
      visitAttributeAsUrlSpecifier({
        type: "use_href",
        node,
        attributeName: "href",
      })
      return
    }
  }
  const visitAttributeAsUrlSpecifier = ({ type, node, attributeName }) => {
    const attribute = getHtmlNodeAttributeByName(node, attributeName)
    const value = attribute ? attribute.value : undefined
    if (value) {
      addDependency({
        type,
        node,
        attribute,
        specifier:
          attributeName === "content-src" ? new URL(value, url).href : value,
      })
    } else if (attributeName === "src") {
      visitAttributeAsUrlSpecifier({
        type,
        node,
        attributeName: "content-src",
      })
    } else if (attributeName === "href") {
      visitAttributeAsUrlSpecifier({
        type,
        node,
        attributeName: "content-href",
      })
    }
  }
  const visitSrcset = ({ type, node }) => {
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
        })
      })
    }
  }
  visitHtmlAst(htmlAst, onNode)
  return htmlUrlMentions
}
