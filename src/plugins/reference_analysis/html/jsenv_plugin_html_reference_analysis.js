import {
  parseHtmlString,
  visitHtmlNodes,
  getHtmlNodeText,
  setHtmlNodeText,
  removeHtmlNodeText,
  getHtmlNodeAttribute,
  getHtmlNodePosition,
  setHtmlNodeAttributes,
  getHtmlNodeAttributePosition,
  analyzeScriptNode,
  parseSrcSet,
  stringifyHtmlAst,
} from "@jsenv/ast";
import { generateInlineContentUrl } from "@jsenv/urls";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

export const jsenvPluginHtmlReferenceAnalysis = ({
  inlineContent,
  inlineConvertedScript,
}) => {
  return {
    name: "jsenv:html_reference_analysis",
    appliesDuring: "*",
    transformUrlContent: {
      html: (urlInfo) =>
        parseAndTransformHtmlReferences(urlInfo, {
          inlineContent,
          inlineConvertedScript,
        }),
    },
  };
};

const parseAndTransformHtmlReferences = async (
  urlInfo,
  { inlineContent, inlineConvertedScript },
) => {
  const content = urlInfo.content;
  const htmlAst = parseHtmlString(content);

  const mutations = [];
  const actions = [];
  const finalizeCallbacks = [];

  const createExternalReference = (
    node,
    attributeName,
    attributeValue,
    { type, subtype, expectedType },
  ) => {
    let position;
    if (getHtmlNodeAttribute(node, "jsenv-cooked-by")) {
      // when generated from inline content,
      // line, column is not "src" nor "inlined-from-src" but "original-position"
      position = getHtmlNodePosition(node);
    } else {
      position = getHtmlNodeAttributePosition(node, attributeName);
    }
    const {
      line,
      column,
      // originalLine, originalColumn
    } = position;
    const debug = getHtmlNodeAttribute(node, "jsenv-debug") !== undefined;

    const { crossorigin, integrity } = readFetchMetas(node);
    const isResourceHint = [
      "preconnect",
      "dns-prefetch",
      "prefetch",
      "preload",
      "modulepreload",
    ].includes(subtype);
    const [reference] = urlInfo.references.found({
      node,
      type,
      subtype,
      expectedType,
      specifier: attributeValue,
      specifierLine: line,
      specifierColumn: column,
      isResourceHint,
      crossorigin,
      integrity,
      debug,
    });
    actions.push(async () => {
      await reference.readGeneratedSpecifier();
      mutations.push(() => {
        setHtmlNodeAttributes(node, {
          [attributeName]: reference.generatedSpecifier,
        });
      });
    });
    return reference;
  };
  const visitHref = (node, referenceProps) => {
    const href = getHtmlNodeAttribute(node, "href");
    if (href) {
      return createExternalReference(node, "href", href, referenceProps);
    }
    return null;
  };
  const visitSrc = (node, referenceProps) => {
    const src = getHtmlNodeAttribute(node, "src");
    if (src) {
      return createExternalReference(node, "src", src, referenceProps);
    }
    return null;
  };
  const visitSrcset = (node, referenceProps) => {
    const srcset = getHtmlNodeAttribute(node, "srcset");
    if (srcset) {
      const srcCandidates = parseSrcSet(srcset);
      return srcCandidates.map((srcCandidate) => {
        return createExternalReference(
          node,
          "srcset",
          srcCandidate.specifier,
          referenceProps,
        );
      });
    }
    return null;
  };

  const createInlineReference = (
    node,
    inlineContent,
    { extension, type, subtype, expectedType, contentType },
  ) => {
    const hotAccept = getHtmlNodeAttribute(node, "hot-accept") !== undefined;
    const { line, column, lineEnd, columnEnd, isOriginal } =
      getHtmlNodePosition(node, { preferOriginal: true });
    const inlineContentUrl = generateInlineContentUrl({
      url: urlInfo.url,
      extension,
      line,
      column,
      lineEnd,
      columnEnd,
    });
    const debug = getHtmlNodeAttribute(node, "jsenv-debug") !== undefined;
    const [inlineReference, inlineUrlInfo] = urlInfo.references.foundInline({
      node,
      type,
      expectedType,
      isOriginalPosition: isOriginal,
      // we remove 1 to the line because imagine the following html:
      // <style>body { color: red; }</style>
      // -> content starts same line as <style> (same for <script>)
      specifierLine: line - 1,
      specifierColumn: column,
      specifier: inlineContentUrl,
      contentType,
      content: inlineContent,
      debug,
    });

    const externalSpecifierAttributeName =
      type === "script"
        ? "inlined-from-src"
        : type === "style"
        ? "inlined-from-href"
        : null;
    if (externalSpecifierAttributeName) {
      const externalSpecifier = getHtmlNodeAttribute(
        node,
        externalSpecifierAttributeName,
      );
      if (externalSpecifier) {
        // create an external ref
        // the goal is only to have the url in the graph (and in dependencies/implitic urls for reload)
        // not to consider the url is actually used (at least during build)
        // maybe we can just exlcude these urls in a special if during build, we'll see
        const externalRef = createExternalReference(
          node,
          externalSpecifierAttributeName,
          externalSpecifier,
          { type, subtype, expectedType },
        );
        inlineReference.prev = externalRef;
        inlineReference.original = externalRef;
        externalRef.next = inlineReference;
      }
    }

    actions.push(async () => {
      await cookInlineContent({
        context,
        inlineContentUrlInfo: inlineUrlInfo,
        inlineContentReference: inlineReference,
      });
      mutations.push(() => {
        if (hotAccept) {
          removeHtmlNodeText(node);
          setHtmlNodeAttributes(node, {
            "jsenv-cooked-by": "jsenv:html_inline_content_analysis",
          });
        } else {
          setHtmlNodeText(node, inlineUrlInfo.content, {
            indentation: false, // indentation would decrease stack trace precision
          });
          setHtmlNodeAttributes(node, {
            "jsenv-cooked-by": "jsenv:html_inline_content_analysis",
          });
        }
      });
    });
    return inlineReference;
  };
  const visitTextContent = (
    node,
    { extension, type, subtype, expectedType, contentType },
  ) => {
    const inlineContent = getHtmlNodeText(node);
    if (!inlineContent) {
      return null;
    }
    return createInlineReference(node, inlineContent, {
      extension,
      type,
      subtype,
      expectedType,
      contentType,
    });
  };

  visitHtmlNodes(htmlAst, {
    link: (linkNode) => {
      const rel = getHtmlNodeAttribute(linkNode, "rel");
      const type = getHtmlNodeAttribute(linkNode, "type");
      const ref = visitHref(linkNode, {
        type: "link_href",
        subtype: rel,
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#including_a_mime_type
        expectedContentType: type,
      });
      if (ref) {
        finalizeCallbacks.push(() => {
          ref.expectedType = decideLinkExpectedType(ref, urlInfo);
        });
      }
    },
    style: inlineContent
      ? (styleNode) => {
          visitTextContent(styleNode, {
            extension: ".css",
            type: "style",
            expectedType: "css",
            contentType: "text/css",
          });
        }
      : null,
    script: (scriptNode) => {
      // during build the importmap is inlined
      // and shoud not be considered as a dependency anymore
      if (
        getHtmlNodeAttribute(scriptNode, "jsenv-inlined-by") ===
        "jsenv:importmap"
      ) {
        return;
      }

      const { type, subtype, contentType, extension } =
        analyzeScriptNode(scriptNode);
      // ignore <script type="whatever">foobar</script>
      // per HTML spec https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-type
      if (type !== "text") {
        const externalRef = visitSrc(scriptNode, {
          type: "script",
          subtype: type,
          expectedType: type,
        });
        if (externalRef) {
          return;
        }
      }

      // now visit the content, if any
      if (!inlineContent) {
        return;
      }
      // If the inline script was already handled by an other plugin, ignore it
      // - we want to preserve inline scripts generated by html supervisor during dev
      // - we want to avoid cooking twice a script during build
      if (
        !inlineConvertedScript &&
        getHtmlNodeAttribute(scriptNode, "jsenv-injected-by") ===
          "jsenv:js_module_fallback"
      ) {
        return;
      }

      const inlineRef = visitTextContent(scriptNode, {
        extension: extension || CONTENT_TYPE.asFileExtension(contentType),
        type: "script",
        subtype,
        expectedType: type,
        contentType,
      });
      if (inlineRef && extension) {
        // 1. <script type="jsx"> becomes <script>
        // 2. <script type="module/jsx"> becomes <script type="module">
        mutations.push(() => {
          setHtmlNodeAttributes(scriptNode, {
            type: type === "js_module" ? "module" : undefined,
          });
        });
      }
    },
    a: (aNode) => {
      visitHref(aNode, {
        type: "a_href",
      });
    },
    iframe: (iframeNode) => {
      visitSrc(iframeNode, {
        type: "iframe_src",
      });
    },
    img: (imgNode) => {
      visitSrc(imgNode, {
        type: "img_src",
      });
      visitSrcset(imgNode, {
        type: "img_srcset",
      });
    },
    source: (sourceNode) => {
      visitSrc(sourceNode, {
        type: "source_src",
      });
      visitSrcset(sourceNode, {
        type: "source_srcset",
      });
    },
    // svg <image> tag
    image: (imageNode) => {
      visitHref(imageNode, {
        type: "image_href",
      });
    },
    use: (useNode) => {
      visitHref(useNode, {
        type: "use_href",
      });
    },
  });
  finalizeCallbacks.forEach((finalizeCallback) => {
    finalizeCallback();
  });

  if (actions.length > 0) {
    await Promise.all(actions.map((action) => action()));
  }
  if (mutations.length === 0) {
    return null;
  }
  mutations.forEach((mutation) => mutation());
  return stringifyHtmlAst(htmlAst);
};

const cookInlineContent = async ({
  context,
  inlineContentUrlInfo,
  inlineContentReference,
}) => {
  try {
    await context.cook(inlineContentUrlInfo, {
      reference: inlineContentReference,
    });
  } catch (e) {
    if (e.code === "PARSE_ERROR") {
      // When something like <style> or <script> contains syntax error
      // the HTML in itself it still valid
      // keep the syntax error and continue with the HTML
      const messageStart =
        inlineContentUrlInfo.type === "css"
          ? `Syntax error on css declared inside <style>`
          : `Syntax error on js declared inside <script>`;

      context.logger.error(`${messageStart}: ${e.cause.reasonCode}
${e.traceMessage}`);
    } else {
      throw e;
    }
  }
};

const crossOriginCompatibleTagNames = ["script", "link", "img", "source"];
const integrityCompatibleTagNames = ["script", "link", "img", "source"];
const readFetchMetas = (node) => {
  const meta = {};
  if (crossOriginCompatibleTagNames.includes(node.nodeName)) {
    const crossorigin = getHtmlNodeAttribute(node, "crossorigin") !== undefined;
    meta.crossorigin = crossorigin;
  }
  if (integrityCompatibleTagNames.includes(node.nodeName)) {
    const integrity = getHtmlNodeAttribute(node, "integrity");
    meta.integrity = integrity;
  }
  return meta;
};

const decideLinkExpectedType = (linkReference, htmlUrlInfo) => {
  const rel = getHtmlNodeAttribute(linkReference.node, "rel");
  if (rel === "webmanifest") {
    return "webmanifest";
  }
  if (rel === "modulepreload") {
    return "js_module";
  }
  if (rel === "stylesheet") {
    return "css";
  }
  if (rel === "preload") {
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#what_types_of_content_can_be_preloaded
    const as = getHtmlNodeAttribute(linkReference.node, "as");
    if (as === "document") {
      return "html";
    }
    if (as === "style") {
      return "css";
    }
    if (as === "script") {
      const firstScriptOnThisUrl = htmlUrlInfo.references.find(
        (refCandidate) =>
          refCandidate.url === linkReference.url &&
          refCandidate.type === "script",
      );
      if (firstScriptOnThisUrl) {
        return firstScriptOnThisUrl.expectedType;
      }
      return undefined;
    }
  }
  return undefined;
};

// const applyWebUrlResolution = (url, baseUrl) => {
//   if (url[0] === "/") {
//     return new URL(url.slice(1), baseUrl).href;
//   }
//   return new URL(url, baseUrl).href;
// };
