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
} from "@jsenv/ast";

import { jsenvPluginHtmlInlineContentAnalysis } from "./jsenv_plugin_html_inline_content_analysis.js";

export const jsenvPluginHtmlReferenceAnalysis = ({
  inlineContent,
  inlineConvertedScript,
}) => {
  return [
    {
      name: "jsenv:html_reference_analysis",
      appliesDuring: "*",
      transformUrlContent: {
        html: parseAndTransformHtmlUrls,
      },
    },
    ...(inlineContent
      ? [
          jsenvPluginHtmlInlineContentAnalysis({
            inlineConvertedScript,
          }),
        ]
      : []),
  ];
};

const parseAndTransformHtmlUrls = async (urlInfo, context) => {
  const url = urlInfo.originalUrl;
  const content = urlInfo.content;
  const htmlAst = parseHtmlString(content, {
    storeOriginalPositions: context.dev,
  });

  const mutations = [];
  const actions = [];
  const finalizeCallbacks = [];

  const createReference = (node, attributeName, attributeValue, props) => {
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
    return onExternalReference({
      ...props,
      specifier: attributeValue,
      node,
      attributeName,
      line,
      column,
      debug,
    });
  };
  const onExternalReference = ({
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
  }) => {
    const { crossorigin, integrity } = readFetchMetas(node);
    const isResourceHint = [
      "preconnect",
      "dns-prefetch",
      "prefetch",
      "preload",
      "modulepreload",
    ].includes(subtype);
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
    });
    actions.push(async () => {
      await context.referenceUtils.readGeneratedSpecifier(reference);
      mutations.push(() => {
        setHtmlNodeAttributes(node, {
          [attributeName]: reference.generatedSpecifier,
        });
      });
    });
  };
  const visitHref = (node, referenceProps) => {
    const href = getHtmlNodeAttribute(node, "href");
    if (href) {
      return createReference(node, "href", href, referenceProps);
    }
    const inlinedFromHref = getHtmlNodeAttribute(node, "inlined-from-href");
    if (inlinedFromHref) {
      return createReference(
        node,
        "inlined-from-href",
        new URL(inlinedFromHref, url).href,
        referenceProps,
      );
    }
    return null;
  };
  const visitSrc = (node, referenceProps) => {
    const src = getHtmlNodeAttribute(node, "src");
    if (src) {
      return createReference(node, "src", src, referenceProps);
    }
    const inlinedFromSrc = getHtmlNodeAttribute(node, "inlined-from-src");
    if (inlinedFromSrc) {
      return createReference(
        node,
        "inlined-from-src",
        new URL(inlinedFromSrc, url).href,
        referenceProps,
      );
    }
    return null;
  };
  const visitSrcset = (node, referenceProps) => {
    const srcset = getHtmlNodeAttribute(node, "srcset");
    if (srcset) {
      const srcCandidates = parseSrcSet(srcset);
      return srcCandidates.map((srcCandidate) => {
        return createReference(
          node,
          "srcset",
          srcCandidate.specifier,
          referenceProps,
        );
      });
    }
    return null;
  };

  visitHtmlNodes(htmlAst, {
    link: (node) => {
      const rel = getHtmlNodeAttribute(node, "rel");
      const type = getHtmlNodeAttribute(node, "type");
      const ref = visitHref(node, {
        type: "link_href",
        subtype: rel,
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload#including_a_mime_type
        expectedContentType: type,
      });
      if (ref) {
        finalizeCallbacks.push(() => {
          ref.expectedType = decideLinkExpectedType(ref, context);
        });
      }
    },
    // style: () => {},
    script: (node) => {
      if (
        getHtmlNodeAttribute(node, "jsenv-inlined-by") === "jsenv:importmap"
      ) {
        // during build the importmap is inlined
        // and shoud not be considered as a dependency anymore
        return;
      }
      const { type } = analyzeScriptNode(node);
      if (type === "text") {
        // ignore <script type="whatever" src="./file.js">
        // per HTML spec https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-type
        // this will be handled by jsenv_plugin_html_inline_content_analysis
        return;
      }
      visitSrc(node, {
        type: "script",
        subtype: type,
        expectedType: type,
      });
    },
    a: (node) => {
      visitHref(node, {
        type: "a_href",
      });
    },
    iframe: (node) => {
      visitSrc(node, {
        type: "iframe_src",
      });
    },
    img: (node) => {
      visitSrc(node, {
        type: "img_src",
      });
      visitSrcset(node, {
        type: "img_srcset",
      });
    },
    source: (node) => {
      visitSrc(node, {
        type: "source_src",
      });
      visitSrcset(node, {
        type: "source_srcset",
      });
    },
    // svg <image> tag
    image: (node) => {
      visitHref(node, {
        type: "image_href",
      });
    },
    use: (node) => {
      visitHref(node, {
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

const decideLinkExpectedType = (linkReference, context) => {
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
      const firstScriptOnThisUrl = context.referenceUtils.find(
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
