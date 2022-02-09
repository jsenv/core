import { urlToFilename } from "@jsenv/filesystem"

import { injectQueryIntoUrlSpecifier } from "@jsenv/core/src/internal/url_utils.js"
import {
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  getIdForInlineHtmlNode,
  removeHtmlNodeAttributeByName,
  setHtmlNodeText,
  assignHtmlNodeAttributes,
  getHtmlNodeLocation,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { htmlSupervisorFiles } from "@jsenv/core/src/internal/jsenv_file_selector.js"

export const superviseScripts = ({
  sourceFileFetcher,
  jsenvFileSelector,
  url,
  canUseScriptTypeModule,
  scripts,
  htmlContent,
}) => {
  const supervisedScripts = []
  const inlineRessources = []
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
      src = sourceFileFetcher.asFileUrlSpecifierIfRemote(src, url)
      if (type === "module") {
        if (!canUseScriptTypeModule) {
          removeHtmlNodeAttributeByName(script, "type")
        }
      } else {
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
      assignHtmlNodeAttributes(script, { "content-src": src })
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
      let inlineSrc = `./${urlToFilename(url)}__inline__${inlineScriptId}.js`
      if (type === "module") {
        if (!canUseScriptTypeModule) {
          removeHtmlNodeAttributeByName(script, "type")
        }
      } else {
        inlineSrc = injectQueryIntoUrlSpecifier(inlineSrc, { script: "" })
      }
      const { line, column } = getHtmlNodeLocation(script)
      inlineRessources.push({
        inlineUrlSite: {
          url,
          line,
          column,
          source: htmlContent,
        },
        specifier: inlineSrc,
        contentType: "application/javascript",
        content: textNode.value,
      })
      supervisedScripts.push({
        script,
        type,
        textContent: textNode.value,
        inlineSrc,
      })
      assignHtmlNodeAttributes(script, { "content-src": inlineSrc })
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
  sourceFileFetcher.updateInlineRessources(url, inlineRessources)
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
