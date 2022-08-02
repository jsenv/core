import {
  parseHtmlString,
  visitHtmlNodes,
  getHtmlNodeAttribute,
  getHtmlNodePosition,
  setHtmlNodeAttributes,
  getHtmlNodeAttributePosition,
  analyzeScriptNode,
  parseSrcSet,
  stringifyHtmlAst,
} from "@jsenv/ast"

export const parseAndTransformHtmlUrls = async (urlInfo, context) => {
  const url = urlInfo.originalUrl
  const content = urlInfo.content
  const { scenarios, referenceUtils } = context
  const htmlAst = parseHtmlString(content, {
    storeOriginalPositions: scenarios.dev,
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
      node,
      attributeName,
      specifier,
    }) => {
      const { crossorigin, integrity } = readFetchMetas(node)

      const isResourceHint = [
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
        isResourceHint,
        crossorigin,
        integrity,
      })
      actions.push(async () => {
        setHtmlNodeAttributes(node, {
          [attributeName]: await referenceUtils.readGeneratedSpecifier(
            reference,
          ),
        })
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

const crossOriginCompatibleTagNames = ["script", "link", "img", "source"]
const integrityCompatibleTagNames = ["script", "link", "img", "source"]
const readFetchMetas = (node) => {
  const meta = {}
  if (crossOriginCompatibleTagNames.includes(node.nodeName)) {
    const crossorigin = getHtmlNodeAttribute(node, "crossorigin") !== undefined
    meta.crossorigin = crossorigin
  }
  if (integrityCompatibleTagNames.includes(node.nodeName)) {
    const integrity = getHtmlNodeAttribute(node, "integrity")
    meta.integrity = integrity
  }
  return meta
}

const visitHtmlUrls = ({ url, htmlAst, onUrl }) => {
  const addDependency = ({
    type,
    subtype,
    expectedType,
    node,
    attributeName,
    specifier,
  }) => {
    const isContentCooked =
      getHtmlNodeAttribute(node, "jsenv-plugin-action") === "content_cooked"
    let position
    if (isContentCooked) {
      // when generated from inline content,
      // line, column is not "src" nor "inlined-from-src" but "original-position"
      position = getHtmlNodePosition(node)
    } else {
      position = getHtmlNodeAttributePosition(node, attributeName)
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
      node,
      attributeName,
    })
  }
  const visitAttributeAsUrlSpecifier = ({ node, attributeName, ...rest }) => {
    const value = getHtmlNodeAttribute(node, attributeName)
    if (value) {
      const jsenvPluginOwner = getHtmlNodeAttribute(node, "jsenv-plugin-owner")
      if (jsenvPluginOwner === "jsenv:importmap") {
        // during build the importmap is inlined
        // and shoud not be considered as a dependency anymore
        return
      }
      addDependency({
        ...rest,
        node,
        attributeName,
        specifier:
          attributeName === "inlined-from-src" ||
          attributeName === "inlined-from-href"
            ? new URL(value, url).href
            : value,
      })
    } else if (attributeName === "src") {
      visitAttributeAsUrlSpecifier({
        ...rest,
        node,
        attributeName: "inlined-from-src",
      })
    } else if (attributeName === "href") {
      visitAttributeAsUrlSpecifier({
        ...rest,
        node,
        attributeName: "inlined-from-href",
      })
    }
  }
  const visitSrcset = ({ type, node }) => {
    const srcset = getHtmlNodeAttribute(node, "srcset")
    if (srcset) {
      const srcCandidates = parseSrcSet(srcset)
      srcCandidates.forEach((srcCandidate) => {
        addDependency({
          type,
          node,
          attributeName: "srcset",
          specifier: srcCandidate.specifier,
        })
      })
    }
  }
  visitHtmlNodes(htmlAst, {
    link: (node) => {
      const rel = getHtmlNodeAttribute(node, "rel")
      const type = getHtmlNodeAttribute(node, "type")
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
      const { type } = analyzeScriptNode(node)
      if (type === "text") {
        // ignore <script type="whatever" src="./file.js">
        // per HTML spec https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-type
        // this will be handled by jsenv_plugin_html_inline_content
        return
      }
      visitAttributeAsUrlSpecifier({
        type: "script_src",
        expectedType: type,
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
  })
}
