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
  const htmlAst = parseHtmlString(content, {
    storeOriginalPositions: context.dev,
  })
  const mentions = visitHtmlUrls({
    url,
    htmlAst,
  })
  const mutations = []
  const actions = []
  for (const mention of mentions) {
    const {
      type,
      subtype,
      expectedType,
      line,
      column,
      originalLine,
      originalColumn,
      node,
      attributeName,
      debug,
      specifier,
    } = mention
    const { crossorigin, integrity } = readFetchMetas(node)
    const isResourceHint = [
      "preconnect",
      "dns-prefetch",
      "prefetch",
      "preload",
      "modulepreload",
    ].includes(subtype)
    const [reference] = context.referenceUtils.found({
      type,
      subtype,
      expectedType,
      originalLine,
      originalColumn,
      specifier,
      specifierLine: line,
      specifierColumn: column,
      isResourceHint,
      crossorigin,
      integrity,
      debug,
    })
    actions.push(async () => {
      await context.referenceUtils.readGeneratedSpecifier(reference)
      mutations.push(() => {
        setHtmlNodeAttributes(node, {
          [attributeName]: reference.generatedSpecifier,
        })
      })
    })
  }
  if (actions.length > 0) {
    await Promise.all(actions.map((action) => action()))
  }
  if (mutations.length === 0) {
    return null
  }
  mutations.forEach((mutation) => mutation())
  return stringifyHtmlAst(htmlAst)
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

const visitHtmlUrls = ({ url, htmlAst }) => {
  const mentions = []
  const finalizeCallbacks = []
  const addMention = ({
    type,
    subtype,
    expectedType,
    node,
    attributeName,
    specifier,
  }) => {
    let position
    if (getHtmlNodeAttribute(node, "jsenv-cooked-by")) {
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
    const debug = getHtmlNodeAttribute(node, "jsenv-debug") !== undefined
    const mention = {
      type,
      subtype,
      expectedType,
      line,
      column,
      // originalLine, originalColumn
      specifier,
      node,
      attributeName,
      debug,
    }
    mentions.push(mention)
    return mention
  }
  const visitAttributeAsUrlSpecifier = ({ node, attributeName, ...rest }) => {
    const value = getHtmlNodeAttribute(node, attributeName)
    if (value) {
      if (
        getHtmlNodeAttribute(node, "jsenv-inlined-by") === "jsenv:importmap"
      ) {
        // during build the importmap is inlined
        // and shoud not be considered as a dependency anymore
        return null
      }
      return addMention({
        ...rest,
        node,
        attributeName,
        specifier:
          attributeName === "inlined-from-src" ||
          attributeName === "inlined-from-href"
            ? new URL(value, url).href
            : value,
      })
    }
    if (attributeName === "src") {
      return visitAttributeAsUrlSpecifier({
        ...rest,
        node,
        attributeName: "inlined-from-src",
      })
    }
    if (attributeName === "href") {
      return visitAttributeAsUrlSpecifier({
        ...rest,
        node,
        attributeName: "inlined-from-href",
      })
    }
    return null
  }
  const visitSrcset = ({ type, node }) => {
    const srcset = getHtmlNodeAttribute(node, "srcset")
    if (srcset) {
      const srcCandidates = parseSrcSet(srcset)
      srcCandidates.forEach((srcCandidate) => {
        addMention({
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
      const mention = visitAttributeAsUrlSpecifier({
        type: "link_href",
        subtype: rel,
        node,
        attributeName: "href",
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#including_a_mime_type
        expectedContentType: type,
      })

      if (mention) {
        finalizeCallbacks.push(() => {
          mention.expectedType = decideLinkExpectedType(mention, mentions)
        })
      }
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
        type: "script",
        subtype: type,
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
    source: (node) => {
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
  finalizeCallbacks.forEach((finalizeCallback) => {
    finalizeCallback()
  })
  return mentions
}

const decideLinkExpectedType = (linkMention, mentions) => {
  const rel = getHtmlNodeAttribute(linkMention.node, "rel")
  if (rel === "webmanifest") {
    return "webmanifest"
  }
  if (rel === "modulepreload") {
    return "js_module"
  }
  if (rel === "stylesheet") {
    return "css"
  }
  if (rel === "preload") {
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#what_types_of_content_can_be_preloaded
    const as = getHtmlNodeAttribute(linkMention.node, "as")
    if (as === "document") {
      return "html"
    }
    if (as === "style") {
      return "css"
    }
    if (as === "script") {
      const firstScriptOnThisUrl = mentions.find(
        (mentionCandidate) =>
          mentionCandidate.url === linkMention.url &&
          mentionCandidate.type === "script",
      )
      if (firstScriptOnThisUrl) {
        return firstScriptOnThisUrl.expectedType
      }
      return undefined
    }
  }
  return undefined
}
