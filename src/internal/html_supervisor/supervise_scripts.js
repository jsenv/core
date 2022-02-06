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
  generateSrcForInlineScript = (inlineScriptId) => {
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
      src &&
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
      if (type !== "module") {
        src = injectQueryIntoUrlSpecifier(src, { script: "" })
      }
      supervisedScripts.push({
        script,
        type,
        src,
        integrity,
        crossorigin,
      })
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
      return
    }
    if (textNode) {
      const inlineScriptId = getIdForInlineHtmlNode(script, scripts)
      let inlineSrc = generateSrcForInlineScript(inlineScriptId)
      if (type !== "module") {
        inlineSrc = injectQueryIntoUrlSpecifier(inlineSrc, {
          script: "",
        })
      }
      supervisedScripts.push({
        script,
        type,
        textContent: textNode.value,
        inlineSrc,
      })
      setHtmlNodeText(
        script,
        generateCodeToSuperviseScript({
          jsenvFileSelector,
          canUseScriptTypeModule,
          type,
          src: inlineSrc,
        }),
      )
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
  integrity,
  crossorigin,
}) => {
  const paramsAsJson = JSON.stringify({ src, integrity, crossorigin })
  if (type === "module") {
    if (canUseScriptTypeModule) {
      const htmlSupervisorFile = jsenvFileSelector.select(htmlSupervisorFiles, {
        canUseScriptTypeModule,
      })
      const specifier =
        htmlSupervisorFile.selected === "source_module"
          ? htmlSupervisorFile.urlRelativeToProject
          : htmlSupervisorFile.urlRelativeToProject
      return `import { superviseScriptTypeModule } from "${specifier}"
superviseScriptTypeModule(${paramsAsJson})`
    }
    return `window.__html_supervisor__.superviseScriptTypeModule(${paramsAsJson})`
  }
  return `window.__html_supervisor__.superviseScript(${paramsAsJson})`
}
