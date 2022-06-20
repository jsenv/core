import {
  parseHtmlString,
  stringifyHtmlAst,
  getHtmlNodeAttributeByName,
  htmlNodePosition,
  visitHtmlAst,
} from "@jsenv/utils/src/html_ast/html_ast.js"
import { htmlAttributeSrcSet } from "@jsenv/utils/src/html_ast/html_attribute_src_set.js"

export const parseAndTransformHtmlUrls = async (urlInfo, context) => {
  const url = urlInfo.originalUrl
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
        originalLine,
        originalColumn,
        specifier,
        specifierLine: line,
        specifierColumn: column,
        isRessourceHint,
      })
      actions.push(async () => {
        attribute.value = await referenceUtils.readGeneratedSpecifier(reference)
      })
    },
  })
  if (actions.length === 0) {
    return null
  }
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
    const generatedFromInlineContent = Boolean(
      getHtmlNodeAttributeByName(node, "generated-from-inline-content"),
    )
    let position
    if (generatedFromInlineContent) {
      // when generated from inline content,
      // line, column is not "src" nor "generated-from-src" but "original-position"
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
  const visitors = {
    link: (node) => {
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
          manifest: "webmanifest",
          modulepreload: "js_module",
          stylesheet: "css",
        }[rel],
      })
    },
    // style: () => {},
    script: (node) => {
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
    },
    a: (node) => {
      visitAttributeAsUrlSpecifier({
        type: "a_href",
        node,
        attributeName: "href",
      })
    },
    iframe: (node) => {
      visitAttributeAsUrlSpecifier({
        type: "iframe_src",
        node,
        attributeName: "src",
      })
    },
    img: (node) => {
      visitAttributeAsUrlSpecifier({
        type: "img_src",
        node,
        attributeName: "src",
      })
      visitSrcset({
        type: "img_srcset",
        node,
      })
    },
    souce: (node) => {
      visitAttributeAsUrlSpecifier({
        type: "source_src",
        node,
        attributeName: "src",
      })
      visitSrcset({
        type: "source_srcset",
        node,
      })
    },
    // svg <image> tag
    image: (node) => {
      visitAttributeAsUrlSpecifier({
        type: "image_href",
        node,
        attributeName: "href",
      })
    },
    use: (node) => {
      visitAttributeAsUrlSpecifier({
        type: "use_href",
        node,
        attributeName: "href",
      })
    },
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
      const generatedBy = getHtmlNodeAttributeByName(node, "generated-by")
      if (generatedBy) {
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
          attributeName === "generated-from-src" ||
          attributeName === "generated-from-href"
            ? new URL(value, url).href
            : value,
      })
    } else if (attributeName === "src") {
      visitAttributeAsUrlSpecifier({
        type,
        subtype,
        expectedType,
        node,
        attributeName: "generated-from-src",
      })
    } else if (attributeName === "href") {
      visitAttributeAsUrlSpecifier({
        type,
        subtype,
        expectedType,
        node,
        attributeName: "generated-from-href",
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
  visitHtmlAst(htmlAst, (node) => {
    const visitor = visitors[node.nodeName]
    if (visitor) {
      visitor(node)
    }
  })
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
