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
} from "@jsenv/importmap"

import {
  parseHtmlString,
  stringifyHtmlAst,
  findNode,
  getHtmlNodeAttributeByName,
  htmlNodePosition,
  removeHtmlNodeAttributeByName,
  setHtmlNodeGeneratedText,
  getHtmlNodeTextNode,
  removeHtmlNode,
} from "@jsenv/utils/html_ast/html_ast.js"
import { generateInlineContentUrl } from "@jsenv/utils/urls/inline_content_url_generator.js"

export const jsenvPluginImportmap = () => {
  let finalImportmap = null
  const importmaps = {}
  const onHtmlImportmapParsed = (importmap, htmlUrl) => {
    importmaps[htmlUrl] = importmap
      ? normalizeImportMap(importmap, htmlUrl)
      : null
    finalImportmap = Object.keys(importmaps).reduce((previous, url) => {
      const importmap = importmaps[url]
      if (!previous) {
        return importmap
      }
      if (!importmap) {
        return previous
      }
      return composeTwoImportMaps(previous, importmap)
    }, null)
  }

  return {
    name: "jsenv:importmap",
    appliesDuring: "*",
    resolveUrl: {
      js_import_export: (reference) => {
        if (!finalImportmap) {
          return null
        }
        try {
          let fromMapping = false
          const result = resolveImport({
            specifier: reference.specifier,
            importer: reference.parentUrl,
            importMap: finalImportmap,
            onImportMapping: () => {
              fromMapping = true
            },
          })
          if (fromMapping) {
            return result
          }
          return null
        } catch (e) {
          if (e.message.includes("bare specifier")) {
            // in theory we should throw to be compliant with web behaviour
            // but for now it's simpler to return null
            // and let a chance to other plugins to handle the bare specifier
            // (node esm resolution)
            // and we want importmap to be prio over node esm so we cannot put this plugin after
            return null
          }
          throw e
        }
      },
    },
    transformUrlContent: {
      html: async (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content)
        const importmap = findNode(htmlAst, (node) => {
          if (node.nodeName !== "script") {
            return false
          }
          const typeAttribute = getHtmlNodeAttributeByName(node, "type")
          if (!typeAttribute || typeAttribute.value !== "importmap") {
            return false
          }
          return true
        })
        if (!importmap) {
          onHtmlImportmapParsed(null, htmlUrlInfo.url)
          return null
        }
        const handleInlineImportmap = async (importmap, textNode) => {
          const { line, column, lineEnd, columnEnd, isOriginal } =
            htmlNodePosition.readNodePosition(importmap, {
              preferOriginal: true,
            })
          const inlineImportmapUrl = generateInlineContentUrl({
            url: htmlUrlInfo.url,
            extension: ".importmap",
            line,
            column,
            lineEnd,
            columnEnd,
          })
          const [inlineImportmapReference, inlineImportmapUrlInfo] =
            context.referenceUtils.foundInline({
              type: "script_src",
              isOriginalPosition: isOriginal,
              specifierLine: line - 1,
              specifierColumn: column,
              specifier: inlineImportmapUrl,
              contentType: "application/importmap+json",
              content: textNode.value,
            })
          await context.cook({
            reference: inlineImportmapReference,
            urlInfo: inlineImportmapUrlInfo,
          })
          setHtmlNodeGeneratedText(importmap, {
            generatedText: inlineImportmapUrlInfo.content,
            generatedBy: "jsenv:importmap",
          })
          onHtmlImportmapParsed(
            JSON.parse(inlineImportmapUrlInfo.content),
            htmlUrlInfo.url,
          )
        }
        const handleImportmapWithSrc = async (importmap, src) => {
          // Browser would throw on remote importmap
          // and won't sent a request to the server for it
          // We must precook the importmap to know its content and inline it into the HTML
          // In this situation the ref to the importmap was already discovered
          // when parsing the HTML
          const importmapReference =
            context.referenceUtils.findByGeneratedSpecifier(src)
          const importmapUrlInfo = context.urlGraph.getUrlInfo(
            importmapReference.url,
          )
          await context.cook({
            reference: importmapReference,
            urlInfo: importmapUrlInfo,
          })
          onHtmlImportmapParsed(
            JSON.parse(importmapUrlInfo.content),
            htmlUrlInfo.url,
          )
          removeHtmlNodeAttributeByName(importmap, "src")
          setHtmlNodeGeneratedText(importmap, {
            generatedText: importmapUrlInfo.content,
            generatedBy: "jsenv:importmap",
            generatedFromSrc: src,
          })

          const { line, column, lineEnd, columnEnd, isOriginal } =
            htmlNodePosition.readNodePosition(importmap, {
              preferOriginal: true,
            })
          const inlineImportmapUrl = generateInlineContentUrl({
            url: htmlUrlInfo.url,
            extension: ".importmap",
            line,
            column,
            lineEnd,
            columnEnd,
          })
          context.referenceUtils.becomesInline(importmapReference, {
            line: line - 1,
            column,
            isOriginal,
            specifier: inlineImportmapUrl,
            contentType: "application/importmap+json",
            content: importmapUrlInfo.content,
          })
        }

        const srcAttribute = getHtmlNodeAttributeByName(importmap, "src")
        const src = srcAttribute ? srcAttribute.value : undefined
        if (src) {
          await handleImportmapWithSrc(importmap, src)
        } else {
          const textNode = getHtmlNodeTextNode(importmap)
          if (textNode) {
            await handleInlineImportmap(importmap, textNode)
          }
        }
        // once this plugin knows the importmap, it will use it
        // to map imports. These import specifiers will be normalized
        // by "formatReferencedUrl" making the importmap presence useless.
        // In dev/test we keep importmap into the HTML to see it even if useless
        // Duing build we get rid of it
        if (context.scenario === "build") {
          removeHtmlNode(importmap)
        }
        return {
          content: stringifyHtmlAst(htmlAst),
        }
      },
    },
  }
}
