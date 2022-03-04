/*
 * Importmap resolution is scoped per html file.
 * To implement the above correctly means each file should track the html
 * file importing it.
 * A given js file might be imported by 2 different html files and should use
 * the corresponding importmap
 *
 * It would be doable by injecting something like ?html_id to each js modules
 * In practice thie would happen if:
 * - 2+ html files are using an importmap
 * - the importmap is not the same
 * - the importmap contains conflicting mappings
 * - This hapens in the same scenario (during dev)
 * As it's unlikely to happen we'll use a lighter strategy which consists info:
 * Merging all importmap found in html files and applying this importmap to everything
 */

import {
  resolveImport,
  composeTwoImportMaps,
  normalizeImportMap,
} from "@jsenv/importmap"
import { urlToFilename } from "@jsenv/filesystem"

import { asUrlWithoutSearch } from "@jsenv/core/src/utils/url_utils.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  getIdForInlineHtmlNode,
  findNode,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  removeHtmlNodeAttributeByName,
  setHtmlNodeText,
  assignHtmlNodeAttributes,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"

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
    resolve: ({ projectDirectoryUrl, parentUrl, specifier }) => {
      const url =
        specifier[0] === "/"
          ? new URL(specifier.slice(1), projectDirectoryUrl).href
          : new URL(specifier, parentUrl).href
      const urlWithoutSearch = asUrlWithoutSearch(url)
      const importmapContent = importmapContents[urlWithoutSearch]
      if (importmapContent) {
        return url
      }
      return null
    },
    load: ({ url }) => {
      const urlWithoutSearch = asUrlWithoutSearch(url)
      const importmapContent = importmapContents[urlWithoutSearch]
      if (!importmapContent) {
        return null
      }
      return {
        contentType: "application/importmap+json",
        content: importmapContent,
      }
    },
    transform: {
      html: async ({ cookFile, url, content }) => {
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
          const inlineImportmapId = getIdForInlineHtmlNode(htmlAst, importmap)
          let inlineImportmapSpecifier = `${urlToFilename(
            url,
          )}@${inlineImportmapId}.importmap`
          const importmapUrl = new URL(inlineImportmapSpecifier, url).href
          importmapContents[importmapUrl] = textNode.value
          const importmapContext = await cookFile({
            parentUrl: url,
            specifierType: "script_src",
            specifier: inlineImportmapSpecifier,
          })
          setHtmlNodeText(importmap, importmapContext.content)
          assignHtmlNodeAttributes(importmap, {
            "content-src": inlineImportmapSpecifier,
          })
          return {
            content: stringifyHtmlAst(htmlAst),
          }
        }
        const srcAttribute = getHtmlNodeAttributeByName(importmap, "src")
        const src = srcAttribute ? srcAttribute.value : undefined
        if (src) {
          const importmapRessource = await cookFile({
            parentUrl: url,
            specifierType: "script_src",
            specifier: src,
          })
          removeHtmlNodeAttributeByName(importmap, "src")
          assignHtmlNodeAttributes(importmap, {
            "content-src": src,
          })
          setHtmlNodeText(importmap, importmapRessource.content)
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
    parsed: {
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
            importer: String(parentUrl),
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
            return null
          }
          throw e
        }
      },
    },
  }
}
