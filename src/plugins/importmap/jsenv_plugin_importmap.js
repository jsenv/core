/*
 * Plugin to read and apply importmap files found in html files.
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

import {
  resolveImport,
  composeTwoImportMaps,
  normalizeImportMap,
} from "@jsenv/importmap";
import {
  parseHtmlString,
  stringifyHtmlAst,
  findHtmlNode,
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
  getHtmlNodePosition,
  getHtmlNodeText,
  setHtmlNodeText,
  removeHtmlNode,
  getUrlForContentInsideHtml,
} from "@jsenv/ast";

export const jsenvPluginImportmap = () => {
  let finalImportmap = null;
  const importmaps = {};
  const onHtmlImportmapParsed = (importmap, htmlUrl) => {
    importmaps[htmlUrl] = importmap
      ? normalizeImportMap(importmap, htmlUrl)
      : null;
    finalImportmap = Object.keys(importmaps).reduce((previous, url) => {
      const importmap = importmaps[url];
      if (!previous) {
        return importmap;
      }
      if (!importmap) {
        return previous;
      }
      return composeTwoImportMaps(previous, importmap);
    }, null);
  };

  return {
    name: "jsenv:importmap",
    appliesDuring: "*",
    resolveReference: {
      js_import: (reference) => {
        if (!finalImportmap) {
          return null;
        }
        try {
          let fromMapping = false;
          const result = resolveImport({
            specifier: reference.specifier,
            importer: reference.ownerUrlInfo.url,
            importMap: finalImportmap,
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
      html: async (htmlUrlInfo) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content);
        const importmap = findHtmlNode(htmlAst, (node) => {
          if (node.nodeName !== "script") {
            return false;
          }
          const type = getHtmlNodeAttribute(node, "type");
          if (type === undefined || type !== "importmap") {
            return false;
          }
          return true;
        });
        if (!importmap) {
          onHtmlImportmapParsed(null, htmlUrlInfo.url);
          return null;
        }
        const handleInlineImportmap = async (importmap, htmlNodeText) => {
          const { line, column, isOriginal } = getHtmlNodePosition(importmap, {
            preferOriginal: true,
          });
          const inlineImportmapUrl = getUrlForContentInsideHtml(importmap, {
            url: htmlUrlInfo.url,
          });
          const inlineImportmapReference = htmlUrlInfo.dependencies.foundInline(
            {
              type: "script",
              isOriginalPosition: isOriginal,
              specifierLine: line - 1,
              specifierColumn: column,
              specifier: inlineImportmapUrl,
              contentType: "application/importmap+json",
              content: htmlNodeText,
            },
          );
          const inlineImportmapUrlInfo = inlineImportmapReference.urlInfo;
          await inlineImportmapUrlInfo.cook();
          setHtmlNodeText(importmap, inlineImportmapUrlInfo.content, {
            indentation: "auto",
          });
          setHtmlNodeAttributes(importmap, {
            "jsenv-cooked-by": "jsenv:importmap",
          });
          onHtmlImportmapParsed(
            JSON.parse(inlineImportmapUrlInfo.content),
            htmlUrlInfo.url,
          );
        };
        const handleImportmapWithSrc = async (importmap, src) => {
          // Browser would throw on remote importmap
          // and won't sent a request to the server for it
          // We must precook the importmap to know its content and inline it into the HTML
          // In this situation the ref to the importmap was already discovered
          // when parsing the HTML
          let importmapReference = null;
          for (const referenceToOther of htmlUrlInfo.referenceToOthersSet) {
            if (referenceToOther.generatedSpecifier === src) {
              importmapReference = referenceToOther;
              break;
            }
          }
          const { line, column, isOriginal } = getHtmlNodePosition(importmap, {
            preferOriginal: true,
          });
          const importmapInlineUrl = getUrlForContentInsideHtml(importmap, {
            url: htmlUrlInfo.url,
          });
          const importmapReferenceInlined = importmapReference.inline({
            line: line - 1,
            column,
            isOriginal,
            specifier: importmapInlineUrl,
            contentType: "application/importmap+json",
          });
          const importmapInlineUrlInfo = importmapReferenceInlined.urlInfo;
          await importmapInlineUrlInfo.cook();
          onHtmlImportmapParsed(
            JSON.parse(importmapInlineUrlInfo.content),
            htmlUrlInfo.url,
          );
          setHtmlNodeText(importmap, importmapInlineUrlInfo.content, {
            indentation: "auto",
          });
          setHtmlNodeAttributes(importmap, {
            "src": undefined,
            "jsenv-inlined-by": "jsenv:importmap",
            "inlined-from-src": src,
          });
        };

        const src = getHtmlNodeAttribute(importmap, "src");
        if (src) {
          await handleImportmapWithSrc(importmap, src);
        } else {
          const htmlNodeText = getHtmlNodeText(importmap);
          if (htmlNodeText) {
            await handleInlineImportmap(importmap, htmlNodeText);
          }
        }
        // once this plugin knows the importmap, it will use it
        // to map imports. These import specifiers will be normalized
        // by "formatReferencedUrl" making the importmap presence useless.
        // In dev/test we keep importmap into the HTML to see it even if useless
        // Duing build we get rid of it
        if (htmlUrlInfo.context.build) {
          removeHtmlNode(importmap);
        }
        return {
          content: stringifyHtmlAst(htmlAst),
        };
      },
    },
  };
};
