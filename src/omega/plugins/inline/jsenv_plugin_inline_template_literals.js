import { createMagicSource } from "@jsenv/core/packages/utils/sourcemap/magic_source.js"
import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { generateInlineContentUrl } from "@jsenv/utils/urls/inline_content_url_generator.js"

export const jsenvPluginInlineTemplateLiterals = () => {
  return {
    name: "jsenv:inline_template_literals",
    appliesDuring: "*",
    transform: {
      js_module: async (
        { url, generatedUrl, content, originalContent },
        { referenceUtils, cook },
      ) => {
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataInlineTemplateLiterals],
          url,
          generatedUrl,
          content,
        })
        const { inlineTemplateLiterals } = metadata
        if (inlineTemplateLiterals.length === 0) {
          return null
        }
        const magicSource = createMagicSource(content)
        await inlineTemplateLiterals.reduce(
          async (previous, inlineTemplateLiteral) => {
            await previous
            const inlineUrl = generateInlineContentUrl({
              url,
              extension: { "text/css": ".css" }[
                inlineTemplateLiteral.contentType
              ],
              line: inlineTemplateLiteral.line,
              column: inlineTemplateLiteral.column,
              lineEnd: inlineTemplateLiteral.lineEnd,
              columnEnd: inlineTemplateLiteral.columnEnd,
            })
            const [inlineReference, inlineUrlInfo] = referenceUtils.foundInline(
              {
                type: "js_inline_template_literal",
                isOriginal: content === originalContent,
                line: inlineTemplateLiteral.line,
                column: inlineTemplateLiteral.column,
                specifier: inlineUrl,
                contentType: inlineTemplateLiteral.contentType,
                content: inlineTemplateLiteral.content,
              },
            )
            await cook({
              reference: inlineReference,
              urlInfo: inlineUrlInfo,
            })
            magicSource.replace({
              start: inlineTemplateLiteral.start,
              end: inlineTemplateLiteral.end,
              replacement: inlineUrlInfo.content,
            })
          },
          Promise.resolve(),
        )
        return magicSource.toContentAndSourcemap()
      },
    },
  }
}

const babelPluginMetadataInlineTemplateLiterals = () => {
  return {
    name: "metadata-inline-template-literals",
    visitor: {
      Program: (programPath, state) => {
        const inlineTemplateLiterals = []
        programPath.traverse({
          TaggedTemplateExpression: (path) => {
            const node = path.node
            const tag = node.tag
            if (!tag) {
              return
            }
            const quasis = node.quasi.quasis
            if (quasis.length !== 1) {
              return
            }
            const templateElementNode = quasis[0]
            const raw = templateElementNode.value.raw
            const tagName = getImportedName(path, tag.name) || tag.name
            if (tagName === "css") {
              inlineTemplateLiterals.push({
                contentType: "text/css",
                content: raw,
                start: templateElementNode.start,
                end: templateElementNode.end,
                line: templateElementNode.loc.start.line,
                column: templateElementNode.loc.start.column,
                lineEnd: templateElementNode.loc.end.line,
                columnEnd: templateElementNode.loc.end.column,
              })
              return
            }
          },
        })
        state.file.metadata.inlineTemplateLiterals = inlineTemplateLiterals
      },
    },
  }
}

const getImportedName = (path, name) => {
  const binding = path.scope.getBinding(name)
  if (binding.path.type === "ImportSpecifier") {
    return binding.path.node.imported.name
  }
  return null
}
