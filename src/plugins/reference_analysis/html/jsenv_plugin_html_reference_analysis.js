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
  getUrlForContentInsideHtml,
} from "@jsenv/ast";

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
    { type, subtype, expectedType, ...rest },
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
    let attributeLocation = node.sourceCodeLocation.attrs[attributeName];
    if (
      !attributeLocation &&
      attributeName === "href" &&
      (node.tagName === "use" || node.tagName === "image")
    ) {
      attributeLocation = node.sourceCodeLocation.attrs["xlink:href"];
    }
    const attributeStart = attributeLocation.startOffset;
    const attributeValueStart = urlInfo.content.indexOf(
      attributeValue,
      attributeStart + `${attributeName}=`.length,
    );
    const attributeValueEnd = attributeValueStart + attributeValue.length;
    const reference = urlInfo.dependencies.found({
      type,
      subtype,
      expectedType,
      specifier: attributeValue,
      specifierLine: line,
      specifierColumn: column,
      specifierStart: attributeValueStart,
      specifierEnd: attributeValueEnd,
      isResourceHint,
      isWeak: isResourceHint,
      crossorigin,
      integrity,
      debug,
      astInfo: { node, attributeName },
      ...rest,
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
    { type, expectedType, contentType },
  ) => {
    const hotAccept = getHtmlNodeAttribute(node, "hot-accept") !== undefined;
    const { line, column, isOriginal } = getHtmlNodePosition(node, {
      preferOriginal: true,
    });
    const inlineContentUrl = getUrlForContentInsideHtml(node, {
      url: urlInfo.url,
    });
    const debug = getHtmlNodeAttribute(node, "jsenv-debug") !== undefined;
    const inlineReference = urlInfo.dependencies.foundInline({
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
      astInfo: { node },
    });

    actions.push(async () => {
      await inlineReference.urlInfo.cook();
      mutations.push(() => {
        if (hotAccept) {
          removeHtmlNodeText(node);
          setHtmlNodeAttributes(node, {
            "jsenv-cooked-by": "jsenv:html_inline_content_analysis",
          });
        } else {
          setHtmlNodeText(node, inlineReference.urlInfo.content, {
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
    { type, subtype, expectedType, contentType },
  ) => {
    const inlineContent = getHtmlNodeText(node);
    if (!inlineContent) {
      return null;
    }
    return createInlineReference(node, inlineContent, {
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
          if (ref.expectedType) {
            // might be set by other plugins, in that case respect it
          } else {
            ref.expectedType = decideLinkExpectedType(ref, urlInfo);
          }
        });
      }
    },
    style: inlineContent
      ? (styleNode) => {
          visitTextContent(styleNode, {
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
        type: "script",
        subtype,
        expectedType: type,
        contentType,
      });
      if (inlineRef) {
        // 1. <script type="jsx"> becomes <script>
        if (type === "js_classic" && extension !== ".js") {
          mutations.push(() => {
            setHtmlNodeAttributes(scriptNode, {
              type: undefined,
            });
          });
        }
        // 2. <script type="module/jsx"> becomes <script type="module">
        if (type === "js_module" && extension !== ".js") {
          mutations.push(() => {
            setHtmlNodeAttributes(scriptNode, {
              type: "module",
            });
          });
        }
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
  const rel = getHtmlNodeAttribute(linkReference.astInfo.node, "rel");
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
    const as = getHtmlNodeAttribute(linkReference.astInfo.node, "as");
    if (as === "document") {
      return "html";
    }
    if (as === "style") {
      return "css";
    }
    if (as === "script") {
      for (const referenceToOther of htmlUrlInfo.referenceToOthersSet) {
        if (referenceToOther.url !== linkReference.url) {
          continue;
        }
        if (referenceToOther.type !== "script") {
          continue;
        }
        return referenceToOther.expectedType;
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
