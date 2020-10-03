import { basename } from "path"
import { resolveUrl, urlToRelativeUrl, urlToFileSystemPath } from "@jsenv/util"

import {
  parseHtmlString,
  parseHtmlDocumentRessources,
  manipulateHtmlDocument,
  transformHtmlDocumentImportmapScript,
  transformHtmlDocumentModuleScripts,
  stringifyHtmlDocument,
} from "../../compiling/compileHtml.js"

// https://github.com/rollup/rollup/issues/2872
export const extractFromHtml = (htmlFileContent, htmlFileUrl) => {
  // const htmlFileRemoteUrl = resolveUrl(value, compileServerOrigin)
  // const htmlCompiledFileRemoteUrl = resolveUrl(value, compileDirectoryRemoteUrl)
  // const htmlFileRelativeUrl = urlToRelativeUrl(htmlFileUrl, projectDirectoryUrl)
  const htmlFileName = basename(urlToFileSystemPath(htmlFileUrl))
  const htmlDocument = parseHtmlString(htmlFileContent)
  const { scripts, styles } = parseHtmlDocumentRessources(htmlDocument)

  const scriptsFromHtml = []
  const scriptsMapping = new Map()
  const handleScriptFound = (script, scriptSimplified) => {
    scriptsMapping.set(script, scriptSimplified)
    scriptsFromHtml.push(scriptSimplified)
  }
  scripts.forEach((script, index) => {
    if (script.attributes.type === "module" && script.attributes.src) {
      const remoteScriptSrc = script.attributes.src
      const remoteScriptUrl = resolveUrl(remoteScriptSrc, htmlFileUrl)
      handleScriptFound(script, {
        type: "remote",
        url: remoteScriptUrl,
        src: remoteScriptSrc,
      })
      return
    }
    if (script.attributes.type === "module" && script.text) {
      const inlineScriptId = `${htmlFileName}.${index}.js`
      const inlineScriptUrl = resolveUrl(inlineScriptId, htmlFileUrl)
      handleScriptFound(script, {
        type: "inline",
        url: inlineScriptUrl,
        content: script.text,
        id: inlineScriptId,
      })
      return
    }
  })

  const stylesFromHtml = []
  styles.forEach((style, index) => {
    if (style.attributes.href) {
      const remoteStyleHref = style.attributes.href
      const remoteStyleUrl = resolveUrl(remoteStyleHref, htmlFileUrl)
      stylesFromHtml.push({
        type: "remote",
        url: remoteStyleUrl,
        href: remoteStyleHref,
      })
    }
    if (style.text) {
      const inlineStyleId = `${htmlFileName}.${index}.css`
      const inlineStyleUrl = resolveUrl(inlineStyleId, htmlFileUrl)
      stylesFromHtml.push({
        type: "inline",
        url: inlineStyleUrl,
        content: style.text,
        href: inlineStyleId,
      })
    }
  })

  const generateHtml = ({ resolveScriptUrl, importMapFileUrl, systemJsScript }) => {
    const importMapFileRelativeUrlForHtml = urlToRelativeUrl(importMapFileUrl, htmlFileUrl)

    manipulateHtmlDocument(htmlDocument, {
      scriptInjections: systemJsScript ? [systemJsScript] : [],
    })
    transformHtmlDocumentImportmapScript(scripts, {
      type: "systemjs-importmap",
      // ensure the html src is the one passed when generating the bundle
      // this is useful in case you have an importmap while developping
      // but want to use a different one to bundle so that
      // the production importmap is smaller
      // but override only if a custom importmap is passed
      src: importMapFileRelativeUrlForHtml,
    })
    transformHtmlDocumentModuleScripts(scripts, {
      generateInlineScriptCode: (_, index) => {
        const scriptUrl = resolveScriptUrl(scriptsMapping.get(scripts[index]))
        return `<script>window.System.import(${JSON.stringify(`./${scriptUrl}`)})</script>`
      },
    })
    const htmlTransformedString = stringifyHtmlDocument(htmlDocument)
    // minify ? minifyHtml(htmlTransformedString, minifyHtmlOptions) : htmlTransformedString
    return htmlTransformedString
  }

  return {
    scriptsFromHtml,
    stylesFromHtml,
    generateHtml,
  }
}
