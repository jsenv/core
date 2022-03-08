import { createMagicSource } from "@jsenv/core/src/utils/sourcemap/magic_source.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"

export const jsenvPluginAutoreload = () => {
  const eventSourceFileUrl = new URL(
    "./client/event_source_client.js",
    import.meta.url,
  ).href
  const importMetaHotClientFileUrl = new URL(
    "./client/import_meta_hot_module.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:autoreload",
    appliesDuring: {
      dev: true,
    },
    transform: {
      html: async ({
        projectDirectoryUrl,
        resolve,
        asClientUrl,
        url,
        content,
      }) => {
        const htmlAst = parseHtmlString(content)
        const eventSourceResolvedUrl = await resolve({
          parentUrl: projectDirectoryUrl,
          specifierType: "js_import_export",
          specifier: eventSourceFileUrl,
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            src: asClientUrl(eventSourceResolvedUrl, url),
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
      js_module: async ({ url, content }) => {
        // The simplicity content.includes() is seducing
        // (The counter part would be to parse js ast and search nodes for import.meta.hot)
        // Yes it means if code contains import.meta.hot in a comment, it will be instrumented
        // but this is unlikely to happen and would not have special consequences
        if (!content.includes("import.meta.hot")) {
          return null
        }
        // For some reason using magic source here produce
        // better sourcemap than doing the equivalent with babel
        // I suspect it's because I was doing injectAstAfterImport(programPath, ast.program.body[0])
        // which is likely not well supported by babel
        const magicSource = createMagicSource({
          url,
          content,
        })
        magicSource.prepend(
          `import { createImportMetaHot } from "${importMetaHotClientFileUrl}"
import.meta.hot = createImportMetaHot(import.meta.url)
`,
        )
        return magicSource.toContentAndSourcemap()
      },
    },
  }
}
