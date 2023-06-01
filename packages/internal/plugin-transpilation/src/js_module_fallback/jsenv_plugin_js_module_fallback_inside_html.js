/*
 * when <script type="module"> cannot be used:
 * - ?js_module_fallback is injected into the src of <script type="module">
 * - js inside <script type="module"> is transformed into classic js
 * - <link rel="modulepreload"> are converted to <link rel="preload">
 */

import { readFileSync } from "node:fs";
import {
  parseHtmlString,
  visitHtmlNodes,
  stringifyHtmlAst,
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
  analyzeScriptNode,
  injectHtmlNodeAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/ast";
import { injectQueryParams, urlToRelativeUrl } from "@jsenv/urls";
import { SOURCEMAP } from "@jsenv/sourcemap";

export const jsenvPluginJsModuleFallbackInsideHtml = ({
  systemJsInjection,
  systemJsClientFileUrl,
}) => {
  const turnIntoJsClassicProxy = (reference) => {
    return injectQueryParams(reference.url, { js_module_fallback: "" });
  };

  return {
    name: "jsenv:js_module_fallback_inside_html",
    appliesDuring: "*",
    redirectReference: {
      link_href: (reference, context) => {
        if (
          context.systemJsTranspilation &&
          reference.subtype === "modulepreload"
        ) {
          return turnIntoJsClassicProxy(reference);
        }
        if (
          context.systemJsTranspilation &&
          reference.subtype === "preload" &&
          reference.expectedType === "js_module"
        ) {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
      script: (reference, context) => {
        if (
          context.systemJsTranspilation &&
          reference.expectedType === "js_module"
        ) {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
      js_url: (reference, context) => {
        if (
          context.systemJsTranspilation &&
          reference.expectedType === "js_module"
        ) {
          return turnIntoJsClassicProxy(reference);
        }
        return null;
      },
    },
    finalizeUrlContent: {
      html: async (urlInfo, context) => {
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
            const reference = context.referenceUtils.find(
              (ref) =>
                ref.generatedSpecifier === href &&
                ref.type === "link_href" &&
                ref.subtype === rel,
            );
            if (!isOrWasExpectingJsModule(reference)) {
              return;
            }
            if (
              rel === "modulepreload" &&
              reference.expectedType === "js_classic"
            ) {
              mutations.push(() => {
                setHtmlNodeAttributes(node, {
                  rel: "preload",
                  as: "script",
                  crossorigin: undefined,
                });
              });
            }
            if (rel === "preload" && reference.expectedType === "js_classic") {
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
              const reference = context.referenceUtils.find(
                (ref) =>
                  ref.generatedSpecifier === src &&
                  ref.type === "script" &&
                  ref.subtype === "js_module",
              );
              if (!reference) {
                return;
              }
              if (reference.expectedType === "js_classic") {
                mutations.push(() => {
                  setHtmlNodeAttributes(node, { type: undefined });
                });
              }
            } else if (context.systemJsTranspilation) {
              mutations.push(() => {
                setHtmlNodeAttributes(node, { type: undefined });
              });
            }
          },
        });
        if (systemJsInjection) {
          let needsSystemJs = false;
          for (const reference of urlInfo.references) {
            if (reference.isResourceHint) {
              // we don't cook resource hints
              // because they might refer to resource that will be modified during build
              // It also means something else HAVE to reference that url in order to cook it
              // so that the preload is deleted by "resync_resource_hints.js" otherwise
              continue;
            }
            if (isOrWasExpectingJsModule(reference)) {
              const dependencyUrlInfo = context.urlGraph.getUrlInfo(
                reference.url,
              );
              try {
                await context.cook(dependencyUrlInfo, { reference });
                if (dependencyUrlInfo.data.jsClassicFormat === "system") {
                  needsSystemJs = true;
                  break;
                }
              } catch (e) {
                if (context.dev && e.code !== "PARSE_ERROR") {
                  needsSystemJs = true;
                  // ignore cooking error, the browser will trigger it again on fetch
                  // + disable cache for this html file because when browser will reload
                  // the error might be gone and we might need to inject systemjs
                  urlInfo.headers["cache-control"] = "no-store";
                } else {
                  throw e;
                }
              }
            }
          }
          if (needsSystemJs) {
            mutations.push(async () => {
              let systemJsFileContent = readFileSync(
                new URL(systemJsClientFileUrl),
                { encoding: "utf8" },
              );
              const sourcemapFound = SOURCEMAP.readComment({
                contentType: "text/javascript",
                content: systemJsFileContent,
              });
              if (sourcemapFound) {
                const sourcemapFileUrl = new URL(
                  sourcemapFound.specifier,
                  systemJsClientFileUrl,
                );
                systemJsFileContent = SOURCEMAP.writeComment({
                  contentType: "text/javascript",
                  content: systemJsFileContent,
                  specifier: urlToRelativeUrl(sourcemapFileUrl, urlInfo.url),
                });
              }
              const [systemJsReference, systemJsUrlInfo] =
                context.referenceUtils.inject({
                  type: "script",
                  expectedType: "js_classic",
                  isInline: true,
                  contentType: "text/javascript",
                  content: systemJsFileContent,
                  specifier: "s.js",
                });
              await context.cook(systemJsUrlInfo, {
                reference: systemJsReference,
              });
              injectHtmlNodeAsEarlyAsPossible(
                htmlAst,
                createHtmlNode({
                  tagName: "script",
                  textContent: systemJsUrlInfo.content,
                }),
                "jsenv:js_module_fallback",
              );
            });
          }
        }
        await Promise.all(mutations.map((mutation) => mutation()));
        return stringifyHtmlAst(htmlAst, {
          cleanupPositionAttributes: context.dev,
        });
      },
    },
  };
};

const isOrWasExpectingJsModule = (reference) => {
  if (isExpectingJsModule(reference)) {
    return true;
  }
  if (reference.original && isExpectingJsModule(reference.original)) {
    return true;
  }
  return false;
};

const isExpectingJsModule = (reference) => {
  return (
    reference.expectedType === "js_module" ||
    reference.searchParams.has("js_module_fallback") ||
    reference.searchParams.has("as_js_classic")
  );
};