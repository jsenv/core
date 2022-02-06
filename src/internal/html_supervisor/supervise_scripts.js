import { urlToFilename, urlToRelativeUrl } from "@jsenv/filesystem"

import { injectQueryIntoUrlSpecifier } from "@jsenv/core/src/internal/url_utils.js"
import {
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  getIdForInlineHtmlNode,
  removeHtmlNodeAttributeByName,
  setHtmlNodeText,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { htmlSupervisorFiles } from "@jsenv/core/src/internal/jsenv_file_selector.js"

export const superviseScripts = ({
  jsenvFileSelector,
  jsenvRemoteDirectory,
  url,
  canUseScriptTypeModule,
  scripts,
  generateInlineScriptSrc = (inlineScriptId) => {
    return `./${urlToFilename(url)}__inline__${inlineScriptId}.js`
  },
}) => {
  const supervisedScripts = []
  scripts.forEach((script) => {
    const dataInjectedAttribute = getHtmlNodeAttributeByName(
      script,
      "data-injected",
    )
    if (dataInjectedAttribute) {
      return
    }
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    const type = typeAttribute ? typeAttribute.value : "application/javascript"
    const srcAttribute = getHtmlNodeAttributeByName(script, "src")
    let src = srcAttribute ? srcAttribute.value : undefined
    if (
      jsenvRemoteDirectory.isRemoteUrl(src) &&
      !jsenvRemoteDirectory.isPreservedUrl(src)
    ) {
      const fileUrl = jsenvRemoteDirectory.fileUrlFromRemoteUrl(src)
      const fileUrlRelativeToHtml = urlToRelativeUrl(fileUrl, url)
      src = `./${fileUrlRelativeToHtml}`
    }
    const integrityAttribute = getHtmlNodeAttributeByName(script, "integrity")
    const integrity = integrityAttribute ? integrityAttribute.value : undefined
    const crossoriginAttribute = getHtmlNodeAttributeByName(
      script,
      "crossorigin",
    )
    const crossorigin = crossoriginAttribute
      ? crossoriginAttribute.value
      : undefined
    const textNode = getHtmlNodeTextNode(script)
    if (src) {
      removeHtmlNodeAttributeByName(script, "src")
      setHtmlNodeText(
        script,
        generateCodeToSuperviseScript({
          jsenvFileSelector,
          canUseScriptTypeModule,
          type,
          src,
          integrity,
          crossorigin,
        }),
      )
      supervisedScripts.push({
        script,
        type,
        src,
        integrity,
        crossorigin,
      })
      return
    }
    if (textNode) {
      const inlineScriptId = getIdForInlineHtmlNode(script, scripts)
      let inlineScriptSrc = generateInlineScriptSrc(inlineScriptId)
      if (type !== "module") {
        inlineScriptSrc = injectQueryIntoUrlSpecifier(inlineScriptSrc, {
          script: "",
        })
      }
      setHtmlNodeText(
        script,
        generateCodeToSuperviseScript({
          jsenvFileSelector,
          canUseScriptTypeModule,
          type,
          src: inlineScriptSrc,
        }),
      )
      supervisedScripts.push({
        script,
        type,
        textContent: textNode.value,
        inlineScriptSrc,
      })
      return
    }
  })
  return supervisedScripts
}

// Ideally jsenv should take into account eventual
// "integrity" and "crossorigin" attribute during supervision
const generateCodeToSuperviseScript = ({
  jsenvFileSelector,
  canUseScriptTypeModule,
  type,
  src,
}) => {
  if (type === "module") {
    const srcAsJson = JSON.stringify(src)
    if (canUseScriptTypeModule) {
      const htmlSupervisorFile = jsenvFileSelector.select(htmlSupervisorFiles, {
        canUseScriptTypeModule: true,
      })
      return `import { superviseDynamicImport } from "@jsenv/core${htmlSupervisorFile.urlRelativeToProject}"
superviseDynamicImport(${srcAsJson})`
    }
    return `window.__html_supervisor__.superviseSystemJsImport(${srcAsJson})`
  }
  return "" // TODO
}
