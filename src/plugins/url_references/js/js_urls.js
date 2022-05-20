import { parseJsUrls } from "@jsenv/utils/js_ast/parse_js_urls.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { isWebWorkerUrlInfo } from "@jsenv/core/src/omega/web_workers.js"

export const parseAndTransformJsUrls = async (urlInfo, context) => {
  const jsMentions = await parseJsUrls({
    js: urlInfo.content,
    url: (urlInfo.data && urlInfo.data.rawUrl) || urlInfo.url,
    isJsModule: urlInfo.type === "js_module",
    isWebWorker: isWebWorkerUrlInfo(urlInfo),
  })
  const { rootDirectoryUrl, referenceUtils } = context
  const actions = []
  const magicSource = createMagicSource(urlInfo.content)
  jsMentions.forEach((jsMention) => {
    const [reference] = referenceUtils.found({
      type: jsMention.type,
      subtype: jsMention.subtype,
      expectedType: jsMention.expectedType,
      expectedSubtype: jsMention.expectedSubtype || urlInfo.subtype,
      line: jsMention.line,
      column: jsMention.column,
      specifier: jsMention.specifier,
      data: jsMention.data,
      baseUrl: {
        "StringLiteral": jsMention.baseUrl,
        "window.origin": rootDirectoryUrl,
        "import.meta.url": urlInfo.url,
        "context.meta.url": urlInfo.url,
        "document.currentScript.src": urlInfo.url,
      }[jsMention.baseUrlType],
    })
    actions.push(async () => {
      magicSource.replace({
        start: jsMention.start,
        end: jsMention.end,
        replacement: await referenceUtils.readGeneratedSpecifier(reference),
      })
    })
  })
  await Promise.all(actions.map((action) => action()))
  return magicSource.toContentAndSourcemap()
}
