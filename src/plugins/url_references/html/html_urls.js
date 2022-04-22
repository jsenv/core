import {
  parseHtmlString,
  stringifyHtmlAst,
  getHtmlNodeAttributeByName,
  htmlNodePosition,
  visitHtmlAst,
} from "@jsenv/utils/html_ast/html_ast.js"
import { htmlAttributeSrcSet } from "@jsenv/utils/html_ast/html_attribute_src_set.js"

export const parseAndTransformHtmlUrls = async (urlInfo, context) => {
  const url = urlInfo.data.rawUrl || urlInfo.url
  const content = urlInfo.content
  const { scenario, referenceUtils } = context
  const htmlAst = parseHtmlString(content, {
    storeOriginalPositions: scenario !== "build",
  })
  const actions = []
  visitHtmlUrls({
    url,
    htmlAst,
    onUrl: ({
      type,
      subtype,
      expectedType,
      line,
      column,
      originalLine,
      originalColumn,
      specifier,
      attribute,
    }) => {
      const isRessourceHint = [
        "preconnect",
        "dns-prefetch",
        "prefetch",
        "preload",
        "modulepreload",
      ].includes(subtype)
      const [reference] = referenceUtils.found({
        type,
        expectedType,
        line,
        column,
        originalLine,
        originalColumn,
        specifier,
        isRessourceHint,
      })
      actions.push(async () => {
        attribute.value = await referenceUtils.readGeneratedSpecifier(reference)
      })
    },
  })
  await Promise.all(actions.map((action) => action()))
  return {
    content: stringifyHtmlAst(htmlAst),
  }
}

const visitHtmlUrls = ({ url, htmlAst, onUrl }) => {
  const addDependency = ({
    type,
    subtype,
    expectedType,
    node,
    attribute,
    specifier,
  }) => {
    const srcGeneratedFromInlineContent = Boolean(
      getHtmlNodeAttributeByName(node, "src-generated-from-inline-content"),
    )
    let position
    if (srcGeneratedFromInlineContent) {
      // when generated from inline content,
      // line, column is not "src" nor "content-src" but "original-position"
      position = htmlNodePosition.readNodePosition(node)
    } else {
      position = htmlNodePosition.readAttributePosition(node, attribute.name)
    }
    const {
      line,
      column,
      // originalLine, originalColumn
    } = position
    onUrl({
      type,
      subtype,
      expectedType,
      line,
      column,
      // originalLine, originalColumn
      specifier,
      attribute,
      // injected:Boolean(getHtmlNodeAttributeByName(node, "injected-by"))
      // srcGeneratedFromInlineContent
      ...readFetchMetas(node),
    })
  }
  const onNode = (node) => {
    if (node.nodeName === "link") {
      const relAttribute = getHtmlNodeAttributeByName(node, "rel")
      const rel = relAttribute ? relAttribute.value : undefined
      const typeAttribute = getHtmlNodeAttributeByName(node, "type")
      const type = typeAttribute ? typeAttribute.value : undefined
      visitAttributeAsUrlSpecifier({
        type: "link_href",
        subtype: rel,
        node,
        attributeName: "href",
        expectedContentType: type,
        expectedType: {
          manifest: "manifest",
          modulepreload: "js_module",
          stylesheet: "css",
          [rel]: undefined,
        }[rel],
      })
      return
    }
    // if (node.nodeName === "style") {
    //   // styles.push(node)
    //   return
    // }
    if (node.nodeName === "script") {
      const typeAttributeNode = getHtmlNodeAttributeByName(node, "type")
      visitAttributeAsUrlSpecifier({
        type: "script_src",
        expectedType: {
          "undefined": "js_classic",
          "text/javascript": "js_classic",
          "module": "js_module",
          "importmap": "importmap",
        }[typeAttributeNode ? typeAttributeNode.value : undefined],
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
  const visitAttributeAsUrlSpecifier = ({
    type,
    subtype,
    expectedType,
    node,
    attributeName,
  }) => {
    const attribute = getHtmlNodeAttributeByName(node, attributeName)
    const value = attribute ? attribute.value : undefined
    if (value) {
      const inlinedBy = getHtmlNodeAttributeByName(node, "inlined-by")
      if (inlinedBy) {
        // during build the importmap is inlined
        // and shoud not be considered as a dependency anymore
        return
      }
      addDependency({
        type,
        subtype,
        expectedType,
        node,
        attribute,
        specifier:
          attributeName === "content-src" ? new URL(value, url).href : value,
      })
    } else if (attributeName === "src") {
      visitAttributeAsUrlSpecifier({
        type,
        subtype,
        expectedType,
        node,
        attributeName: "content-src",
      })
    } else if (attributeName === "href") {
      visitAttributeAsUrlSpecifier({
        type,
        subtype,
        expectedType,
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
}

const crossOriginCompatibleTagNames = ["script", "link", "img", "source"]
const integrityCompatibleTagNames = ["script", "link", "img", "source"]
const readFetchMetas = (node) => {
  const meta = {}
  if (crossOriginCompatibleTagNames.includes(node.nodeName)) {
    const crossoriginAttribute = getHtmlNodeAttributeByName(node, "crossorigin")
    meta.crossorigin = crossoriginAttribute
      ? crossoriginAttribute.value
      : undefined
  }
  if (integrityCompatibleTagNames.includes(node.nodeName)) {
    const integrityAttribute = getHtmlNodeAttributeByName(node, "integrity")
    meta.integrity = integrityAttribute ? integrityAttribute.value : undefined
  }
  return meta
}
