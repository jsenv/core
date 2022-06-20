import { createMagicSource } from "@jsenv/sourcemap"
import { parseJsUrls } from "@jsenv/utils/js_ast/parse_js_urls.js"

import { isWebWorkerUrlInfo } from "@jsenv/core/src/omega/web_workers.js"

export const parseAndTransformJsUrls = async (urlInfo, context) => {
  const jsMentions = await parseJsUrls({
    js: urlInfo.content,
    url: urlInfo.originalUrl,
    isJsModule: urlInfo.type === "js_module",
    isWebWorker: isWebWorkerUrlInfo(urlInfo),
  })
  const { rootDirectoryUrl, referenceUtils } = context
  const actions = []
  const magicSource = createMagicSource(urlInfo.content)
  urlInfo.data.usesImport = false
  urlInfo.data.usesExport = false
  urlInfo.data.usesImportAssertion = false
  jsMentions.forEach((jsMention) => {
    if (jsMention.assert) {
      urlInfo.data.usesImportAssertion = true
    }
    if (
      jsMention.subtype === "import_static" ||
      jsMention.subtype === "import_dynamic"
    ) {
      urlInfo.data.usesImport = true
    }
    if (jsMention.subtype === "export") {
      urlInfo.data.usesExport = true
    }
    const [reference] = referenceUtils.found({
      type: jsMention.type,
      subtype: jsMention.subtype,
      expectedType: jsMention.expectedType,
      expectedSubtype: jsMention.expectedSubtype || urlInfo.subtype,
      specifier: jsMention.specifier,
      specifierStart: jsMention.specifierStart,
      specifierEnd: jsMention.specifierEnd,
      specifierLine: jsMention.specifierLine,
      specifierColumn: jsMention.specifierColumn,
      data: jsMention.data,
      baseUrl: {
        "StringLiteral": jsMention.baseUrl,
        "window.origin": rootDirectoryUrl,
        "import.meta.url": urlInfo.url,
        "context.meta.url": urlInfo.url,
        "document.currentScript.src": urlInfo.url,
      }[jsMention.baseUrlType],
      assert: jsMention.assert,
      assertNode: jsMention.assertNode,
      typePropertyNode: jsMention.typePropertyNode,
    })
    actions.push(async () => {
      const replacement = await referenceUtils.readGeneratedSpecifier(reference)
      magicSource.replace({
        start: jsMention.specifierStart,
        end: jsMention.specifierEnd,
        replacement,
      })
      if (reference.mutation) {
        reference.mutation(magicSource)
      }
    })
  })
  await Promise.all(actions.map((action) => action()))
  const { content, sourcemap } = magicSource.toContentAndSourcemap()
  return { content, sourcemap }
}
