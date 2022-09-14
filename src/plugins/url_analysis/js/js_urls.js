import { createMagicSource } from "@jsenv/sourcemap"
import { parseJsUrls } from "@jsenv/ast"

import { isWebWorkerUrlInfo } from "@jsenv/core/src/kitchen/web_workers.js"

export const parseAndTransformJsUrls = async (urlInfo, context) => {
  const jsMentions = await parseJsUrls({
    js: urlInfo.content,
    url: urlInfo.originalUrl,
    isJsModule: urlInfo.type === "js_module",
    isWebWorker: isWebWorkerUrlInfo(urlInfo),
  })
  const actions = []
  const magicSource = createMagicSource(urlInfo.content)
  jsMentions.forEach((jsMention) => {
    if (
      jsMention.subtype === "import_static" ||
      jsMention.subtype === "import_dynamic"
    ) {
      urlInfo.data.usesImport = true
    }
    const [reference] = context.referenceUtils.found({
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
        "window.location": urlInfo.url,
        "window.origin": context.rootDirectoryUrl,
        "import.meta.url": urlInfo.url,
        "context.meta.url": urlInfo.url,
        "document.currentScript.src": urlInfo.url,
      }[jsMention.baseUrlType],
      assert: jsMention.assert,
      assertNode: jsMention.assertNode,
      typePropertyNode: jsMention.typePropertyNode,
    })
    actions.push(async () => {
      const replacement = await context.referenceUtils.readGeneratedSpecifier(
        reference,
      )
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
