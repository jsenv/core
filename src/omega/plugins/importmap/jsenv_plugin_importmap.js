/*
 * Plugin to read and apply importmap files found in html files.
 * - feeds importmap files to jsenv plugins
 * - use importmap to resolve import (when there is one + fallback to other resolution mecanism)
 * - inline importmap with [src=""]
 *
 * A 100% compliant importmap resolution should scope importmap resolution
 * per html file. It would be doable by adding ?html_id to each js file in order to track
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
import { urlToFilename } from "@jsenv/filesystem"

import {
  parseHtmlString,
  stringifyHtmlAst,
  getIdForInlineHtmlNode,
  findNode,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  htmlNodePosition,
  removeHtmlNodeAttributeByName,
  setHtmlNodeText,
  assignHtmlNodeAttributes,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"
import { stringifyUrlSite } from "@jsenv/core/src/utils/url_trace.js"

export const jsenvPluginImportmap = () => {
  const importmapSupervisor = jsenvPluginImportmapSupervisor()
  const importmapResolution = jsenvPluginImportmapResolution()

  return [importmapSupervisor, importmapResolution]
}

const jsenvPluginImportmapSupervisor = () => {
  const importmapContents = {}

  return {
    name: "jsenv:importmap_supervisor",
    appliesDuring: "*",
    resolve: ({ parentUrl, specifier }) => {
      const url = new URL(specifier, parentUrl).href
      const importmapContent = importmapContents[url]
      if (importmapContent) {
        return url
      }
      return null
    },
    load: ({ url }) => {
      const importmapContent = importmapContents[url]
      if (!importmapContent) {
        return null
      }
      return {
        contentType: "application/importmap+json",
        content: importmapContent,
      }
    },
    transform: {
      html: async (
        { url, originalContent, content, references },
        { urlGraph, addReference, cook },
      ) => {
        const htmlAst = parseHtmlString(content)
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
          return null
        }
        const textNode = getHtmlNodeTextNode(importmap)
        if (textNode) {
          const { line, column } = htmlNodePosition.readNodePosition(
            importmap,
            {
              preferOriginal: true,
            },
          )
          const inlineImportmapId = getIdForInlineHtmlNode(htmlAst, importmap)
          const importmapReference = addReference({
            trace: stringifyUrlSite({
              url,
              content: originalContent,
              line,
              column,
            }),
            type: "script_src",
            specifier: `${urlToFilename(url)}@${inlineImportmapId}.importmap`,
          })
          const importmapUrlInfo = urlGraph.getUrlInfo(importmapReference)
          importmapUrlInfo.data.isInline = true
          importmapUrlInfo.data.inlineUrlSite = {
            url,
            content: originalContent, // original because it's the origin line and column
            line,
            column,
          }
          importmapContents[importmapReference.url] = textNode.value
          await cook({
            reference: importmapReference,
            urlInfo: importmapUrlInfo,
          })
          setHtmlNodeText(importmap, importmapUrlInfo.content)
          assignHtmlNodeAttributes(importmap, {
            "content-src": importmapReference.specifier,
          })
          return {
            content: stringifyHtmlAst(htmlAst),
          }
        }
        const srcAttribute = getHtmlNodeAttributeByName(importmap, "src")
        const src = srcAttribute ? srcAttribute.value : undefined
        if (src) {
          // Browser would throw on remote importmap
          // and won't sent a request to the server for it
          // We must precook the importmap to know its content and inline it into the HTML
          // In this ituation the ref to the importmap was already discovered
          // when parsing the HTML
          const importmapReference = references.find(
            (reference) => reference.specifier === src,
          )
          const importmapUrlInfo = urlGraph.getUrlInfo(importmapReference.url)
          await cook({
            reference: importmapReference,
            urlInfo: importmapUrlInfo,
          })
          removeHtmlNodeAttributeByName(importmap, "src")
          assignHtmlNodeAttributes(importmap, {
            "content-src": src,
          })
          setHtmlNodeText(importmap, importmapUrlInfo.content)
          return {
            content: stringifyHtmlAst(htmlAst),
          }
        }
        return null
      },
    },
  }
}

const jsenvPluginImportmapResolution = () => {
  const importmaps = []
  let importmap = {}
  const updateImportmap = () => {
    importmap = importmaps.reduce((previous, importmap) => {
      return composeTwoImportMaps(previous, importmap)
    }, {})
  }
  return {
    name: "jsenv:importmap_resolution",
    appliesDuring: "*",
    cooked: {
      importmap: ({ url, content }) => {
        const importmapRaw = JSON.parse(content)
        const importmap = normalizeImportMap(importmapRaw, url)
        importmaps.push(importmap)
        updateImportmap()
        return () => {
          const index = importmaps.indexOf(importmap)
          if (index > -1) {
            importmaps.splice(index, 1)
            updateImportmap()
          }
        }
      },
    },
    resolve: {
      js_import_export: ({ parentUrl, specifier }) => {
        if (importmaps.length === 0) {
          return null
        }
        try {
          let fromMapping = false
          const result = resolveImport({
            specifier,
            importer: parentUrl,
            importMap: importmap,
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
  }
}
