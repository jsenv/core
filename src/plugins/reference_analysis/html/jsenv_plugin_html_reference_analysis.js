import {
  parseHtml,
  visitHtmlNodes,
  getHtmlNodeText,
  setHtmlNodeText,
  removeHtmlNodeText,
  removeHtmlNode,
  getHtmlNodeAttribute,
  getHtmlNodePosition,
  setHtmlNodeAttributes,
  getHtmlNodeAttributePosition,
  analyzeScriptNode,
  parseSrcSet,
  stringifyHtmlAst,
  getUrlForContentInsideHtml,
} from "@jsenv/ast";
import {
  resolveImport,
  composeTwoImportMaps,
  normalizeImportMap,
} from "@jsenv/importmap";

export const jsenvPluginHtmlReferenceAnalysis = ({
  inlineContent,
  inlineConvertedScript,
}) => {
  /*
   * About importmap found in HTML files:
   * - feeds importmap files to jsenv kitchen
   * - use importmap to resolve import (when there is one + fallback to other resolution mecanism)
   * - inline importmap with [src=""]
   *
   * A correct importmap resolution should scope importmap resolution per html file.
   * It would be doable by adding ?html_id to each js file in order to track
   * the html file importing it.
   * Considering it happens only when all the following conditions are met:
   * - 2+ html files are using an importmap
   * - the importmap used is not the same
   * - the importmap contain conflicting mappings
   * - these html files are both executed during the same scenario (dev, test, build)
   * And that it would be ugly to see ?html_id all over the place
   * -> The importmap resolution implemented here takes a shortcut and does the following:
   * - All importmap found are merged into a single one that is applied to every import specifiers
   */

  let globalImportmap = null;
  const importmaps = {};
  let importmapLoadingCount = 0;
  const allImportmapLoadedCallbackSet = new Set();
  const startLoadingImportmap = (htmlUrlInfo) => {
    importmapLoadingCount++;
    return (importmapUrlInfo) => {
      const htmlUrl = htmlUrlInfo.url;
      if (importmapUrlInfo) {
        // importmap was found in this HTML file and is known
        const importmap = JSON.parse(importmapUrlInfo.content);
        importmaps[htmlUrl] = normalizeImportMap(importmap, htmlUrl);
      } else {
        // no importmap in this HTML file
        importmaps[htmlUrl] = null;
      }
      globalImportmap = Object.keys(importmaps).reduce((previous, url) => {
        const importmap = importmaps[url];
        if (!previous) {
          return importmap;
        }
        if (!importmap) {
          return previous;
        }
        return composeTwoImportMaps(previous, importmap);
      }, null);

      importmapLoadingCount--;
      if (importmapLoadingCount === 0) {
        allImportmapLoadedCallbackSet.forEach((callback) => {
          callback();
        });
        allImportmapLoadedCallbackSet.clear();
      }
    };
  };

  return {
    name: "jsenv:html_reference_analysis",
    appliesDuring: "*",
    resolveReference: {
      js_import: (reference) => {
        if (!globalImportmap) {
          return null;
        }
        try {
          let fromMapping = false;
          const result = resolveImport({
            specifier: reference.specifier,
            importer: reference.ownerUrlInfo.url,
            importMap: globalImportmap,
            onImportMapping: () => {
              fromMapping = true;
            },
          });
          if (fromMapping) {
            return result;
          }
          return null;
        } catch (e) {
          if (e.message.includes("bare specifier")) {
            // in theory we should throw to be compliant with web behaviour
            // but for now it's simpler to return null
            // and let a chance to other plugins to handle the bare specifier
            // (node esm resolution)
            // and we want importmap to be prio over node esm so we cannot put this plugin after
            return null;
          }
          throw e;
        }
      },
    },
    transformUrlContent: {
      js_module: async () => {
        // wait for importmap if any
        // so that resolveReference can happen with importmap
        if (importmapLoadingCount) {
          await new Promise((resolve) => {
            allImportmapLoadedCallbackSet.add(resolve);
          });
        }
      },
      html: async (urlInfo) => {
        let importmapFound = false;
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        const importmapLoaded = startLoadingImportmap(urlInfo);

        try {
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
            const debug =
              getHtmlNodeAttribute(node, "jsenv-debug") !== undefined;

            const { crossorigin, integrity } = readFetchMetas(node);
            const isResourceHint = [
              "preconnect",
              "dns-prefetch",
              "prefetch",
              "preload",
              "modulepreload",
            ].includes(subtype);
            let attributeLocation =
              node.sourceCodeLocation.attrs[attributeName];
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
            const attributeValueEnd =
              attributeValueStart + attributeValue.length;
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
              return createExternalReference(
                node,
                "href",
                href,
                referenceProps,
              );
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
            const hotAccept =
              getHtmlNodeAttribute(node, "hot-accept") !== undefined;
            const { line, column, isOriginal } = getHtmlNodePosition(node, {
              preferOriginal: true,
            });
            const inlineContentUrl = getUrlForContentInsideHtml(node, {
              htmlUrl: urlInfo.url,
            });
            const debug =
              getHtmlNodeAttribute(node, "jsenv-debug") !== undefined;
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

          visitNonIgnoredHtmlNode(htmlAst, {
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
              const { type, subtype, contentType, extension } =
                analyzeScriptNode(scriptNode);
              if (type === "text") {
                // ignore <script type="whatever">foobar</script>
                // per HTML spec https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-type
                return;
              }
              if (type === "importmap") {
                importmapFound = true;

                const src = getHtmlNodeAttribute(scriptNode, "src");
                if (src) {
                  // Browser would throw on remote importmap
                  // and won't sent a request to the server for it
                  // We must precook the importmap to know its content and inline it into the HTML
                  const importmapReference = createExternalReference(
                    scriptNode,
                    "src",
                    src,
                    {
                      type: "script",
                      subtype: "importmap",
                      expectedType: "importmap",
                    },
                  );
                  const { line, column, isOriginal } = getHtmlNodePosition(
                    scriptNode,
                    {
                      preferOriginal: true,
                    },
                  );
                  const importmapInlineUrl = getUrlForContentInsideHtml(
                    scriptNode,
                    {
                      htmlUrl: urlInfo.url,
                    },
                  );
                  const importmapReferenceInlined = importmapReference.inline({
                    line: line - 1,
                    column,
                    isOriginal,
                    specifier: importmapInlineUrl,
                    contentType: "application/importmap+json",
                  });
                  const importmapInlineUrlInfo =
                    importmapReferenceInlined.urlInfo;
                  actions.push(async () => {
                    try {
                      await importmapInlineUrlInfo.cook();
                    } finally {
                      importmapLoaded(importmapInlineUrlInfo);
                    }
                    mutations.push(() => {
                      setHtmlNodeText(
                        scriptNode,
                        importmapInlineUrlInfo.content,
                        {
                          indentation: "auto",
                        },
                      );
                      setHtmlNodeAttributes(scriptNode, {
                        "src": undefined,
                        "jsenv-inlined-by": "jsenv:html_reference_analysis",
                        "inlined-from-src": src,
                      });
                    });
                  });
                } else {
                  const htmlNodeText = getHtmlNodeText(scriptNode);
                  if (htmlNodeText) {
                    const importmapReference = createInlineReference(
                      scriptNode,
                      htmlNodeText,
                      {
                        type: "script",
                        expectedType: "importmap",
                        contentType: "application/importmap+json",
                      },
                    );
                    const inlineImportmapUrlInfo = importmapReference.urlInfo;
                    actions.push(async () => {
                      try {
                        await inlineImportmapUrlInfo.cook();
                      } finally {
                        importmapLoaded(inlineImportmapUrlInfo);
                      }
                      mutations.push(() => {
                        setHtmlNodeText(
                          scriptNode,
                          inlineImportmapUrlInfo.content,
                          {
                            indentation: "auto",
                          },
                        );
                        setHtmlNodeAttributes(scriptNode, {
                          "jsenv-cooked-by": "jsenv:html_reference_analysis",
                        });
                      });
                    });
                  }
                }
                // once this plugin knows the importmap, it will use it
                // to map imports. These import specifiers will be normalized
                // by "formatReference" making the importmap presence useless.
                // In dev/test we keep importmap into the HTML to see it even if useless
                // Duing build we get rid of it
                if (urlInfo.context.build) {
                  mutations.push(() => {
                    removeHtmlNode(scriptNode);
                  });
                }
                return;
              }
              const externalRef = visitSrc(scriptNode, {
                type: "script",
                subtype: type,
                expectedType: type,
              });
              if (externalRef) {
                return;
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
          if (!importmapFound) {
            importmapLoaded();
          }
          finalizeCallbacks.forEach((finalizeCallback) => {
            finalizeCallback();
          });

          if (actions.length > 0) {
            await Promise.all(actions.map((action) => action()));
            actions.length = 0;
          }
          if (mutations.length === 0) {
            return null;
          }
          mutations.forEach((mutation) => mutation());
          mutations.length = 0;
          return stringifyHtmlAst(htmlAst);
        } catch (e) {
          importmapLoaded();
          throw e;
        }
      },
    },
  };
};

const visitNonIgnoredHtmlNode = (htmlAst, visitors) => {
  const visitorsInstrumented = {};
  for (const key of Object.keys(visitors)) {
    visitorsInstrumented[key] = (node) => {
      const jsenvIgnoreAttribute = getHtmlNodeAttribute(node, "jsenv-ignore");
      if (jsenvIgnoreAttribute !== undefined) {
        return;
      }
      visitors[key](node);
    };
  }
  visitHtmlNodes(htmlAst, visitorsInstrumented);
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
