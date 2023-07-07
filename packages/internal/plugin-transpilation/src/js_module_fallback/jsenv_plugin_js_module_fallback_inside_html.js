/*
 * when <script type="module"> cannot be used:
 * - ?js_module_fallback is injected into the src of <script type="module">
 * - js inside <script type="module"> is transformed into classic js
 * - <link rel="modulepreload"> are converted to <link rel="preload">
 */

import { injectQueryParams } from "@jsenv/urls";
import {
  parseHtmlString,
  visitHtmlNodes,
  stringifyHtmlAst,
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
  analyzeScriptNode,
} from "@jsenv/ast";

export const jsenvPluginJsModuleFallbackInsideHtml = () => {
  const turnIntoJsClassicProxy = (reference) => {
    // not needed for now: redirections are disabled
    // for getWithoutSearchParam
    // if (
    //   reference.prev &&
    //   reference.prev.searchParams.has("js_module_fallback")
    // ) {
    //   return null;
    // }
    return injectQueryParams(reference.url, { js_module_fallback: "" });
  };

  return {
    name: "jsenv:js_module_fallback_inside_html",
    appliesDuring: "*",
    redirectReference: {
      link_href: (reference) => {
        if (
          reference.ownerUrlInfo.context.systemJsTranspilation &&
          reference.subtype === "modulepreload"
        ) {
          return turnIntoJsClassicProxy(reference);
        }
        if (
          reference.ownerUrlInfo.context.systemJsTranspilation &&
          reference.subtype === "preload" &&
          reference.expectedType === "js_module"
        ) {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
      script: (reference) => {
        if (
          reference.ownerUrlInfo.context.systemJsTranspilation &&
          reference.expectedType === "js_module"
        ) {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
      js_url: (reference) => {
        if (
          reference.ownerUrlInfo.context.systemJsTranspilation &&
          reference.expectedType === "js_module"
        ) {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
    },
    finalizeUrlContent: {
      html: async (urlInfo) => {
        const htmlAst = parseHtmlString(urlInfo.content);
        const mutations = [];
        visitHtmlNodes(htmlAst, {
          link: (node) => {
            const rel = getHtmlNodeAttribute(node, "rel");
            if (rel !== "modulepreload" && rel !== "preload") {
              return;
            }
            const href = getHtmlNodeAttribute(node, "href");
            if (!href) {
              return;
            }
            let linkHintReference = null;
            for (const referenceToOther of urlInfo.referenceToOthersSet) {
              if (
                referenceToOther.generatedSpecifier === href &&
                referenceToOther.type === "link_href" &&
                referenceToOther.subtype === rel
              ) {
                linkHintReference = referenceToOther;
                break;
              }
            }
            if (!wasOrWillBeConvertedToJsClassic(linkHintReference)) {
              return;
            }
            if (rel === "modulepreload") {
              mutations.push(() => {
                setHtmlNodeAttributes(node, {
                  rel: "preload",
                  as: "script",
                  crossorigin: undefined,
                });
              });
            }
            if (rel === "preload") {
              mutations.push(() => {
                setHtmlNodeAttributes(node, { crossorigin: undefined });
              });
            }
          },
          script: (node) => {
            const { type } = analyzeScriptNode(node);
            if (type !== "js_module") {
              return;
            }
            const src = getHtmlNodeAttribute(node, "src");
            if (src) {
              let scriptTypeModuleReference = null;
              for (const referenceToOther of urlInfo.referenceToOthersSet) {
                if (
                  referenceToOther.generatedSpecifier === src &&
                  referenceToOther.type === "script" &&
                  referenceToOther.subtype === "js_module"
                ) {
                  scriptTypeModuleReference = referenceToOther;
                  break;
                }
              }
              if (!scriptTypeModuleReference) {
                return;
              }
              if (scriptTypeModuleReference.expectedType === "js_classic") {
                mutations.push(() => {
                  setHtmlNodeAttributes(node, { type: undefined });
                });
              }
            } else if (urlInfo.context.systemJsTranspilation) {
              mutations.push(() => {
                setHtmlNodeAttributes(node, { type: undefined });
              });
            }
          },
        });
        await Promise.all(mutations.map((mutation) => mutation()));
        return stringifyHtmlAst(htmlAst, {
          cleanupPositionAttributes: urlInfo.context.dev,
        });
      },
    },
  };
};

const wasOrWillBeConvertedToJsClassic = (reference) => {
  if (reference.expectedType !== "js_module") {
    return false;
  }
  if (willBeConvertedToJsClassic(reference)) {
    return true;
  }
  let prev = reference.prev;
  while (prev) {
    if (prev.expectedType === "js_classic") {
      return true;
    }
    if (willBeConvertedToJsClassic(prev)) {
      return true;
    }
    prev = prev.prev;
  }

  return false;
};

const willBeConvertedToJsClassic = (reference) => {
  return (
    reference.searchParams.has("js_module_fallback") ||
    reference.searchParams.has("as_js_classic")
  );
};
