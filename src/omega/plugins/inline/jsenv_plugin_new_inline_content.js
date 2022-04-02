/*
 * Needs to be updated so that it sill works in the following cases:
 * - templates literals transformed to regular stuff by babel
 * - tagged name renamed by rollup
 * - the template named is minified by terser
 * In the cases above I must remain capable to recoginize the template literal
 * to be able to update the urls inside (and even version the urls)
 * because url versioning happens after minification it can be challenging
 *
 * TODO: use "keep_classnames" https://github.com/terser/terser#compress-options
 * so that new InlineContent can be recognized after minification
 */

import { createMagicSource } from "@jsenv/core/packages/utils/sourcemap/magic_source.js"
import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { generateInlineContentUrl } from "@jsenv/utils/urls/inline_content_url_generator.js"

export const jsenvPluginNewInlineContent = () => {
  return {
    name: "jsenv:new_inline_content",
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
        const { inlineContentCalls } = metadata
        if (inlineContentCalls.length === 0) {
          return null
        }
        const magicSource = createMagicSource(content)
        await inlineContentCalls.reduce(async (previous, inlineContentCall) => {
          await previous
          const inlineUrl = generateInlineContentUrl({
            url,
            extension: {
              "text/css": ".css",
              "application/json": ".json",
              "text/plain": ".txt",
            }[inlineContentCall.type],
            line: inlineContentCall.line,
            column: inlineContentCall.column,
            lineEnd: inlineContentCall.lineEnd,
            columnEnd: inlineContentCall.columnEnd,
          })
          const [inlineReference, inlineUrlInfo] = referenceUtils.foundInline({
            type: "js_inline_template_literal",
            isOriginal: content === originalContent,
            line: inlineContentCall.line,
            column: inlineContentCall.column,
            specifier: inlineUrl,
            contentType: inlineContentCall.type,
            content: inlineContentCall.raw,
          })
          await cook({
            reference: inlineReference,
            urlInfo: inlineUrlInfo,
          })
          magicSource.replace({
            start: inlineContentCall.start,
            end: inlineContentCall.end,
            replacement: inlineContentCall.formatContent(inlineUrlInfo.content),
          })
        }, Promise.resolve())
        return magicSource.toContentAndSourcemap()
      },
    },
  }
}

const babelPluginMetadataInlineTemplateLiterals = () => {
  return {
    name: "metadata-new-inline-content",
    visitor: {
      Program: (programPath, state) => {
        const inlineContentCalls = []
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
              inlineContentCalls.push({
                contentType: "text/css",
                content: raw,
                ...getNodePosition(templateElementNode),
                formatContent: (content) => content,
              })
              return
            }
          },
          // will not happen in practice because
          // template literals support is good enough by default for jsenv
          // default browser support
          // CallExpression: (path) => {
          //   const node = path.node
          //   const callee = node.callee
          //   if (callee.type !== "Identifier") {
          //     return
          //   }
          //   const calleeName = getImportedName(path, callee.name) || callee.name
          //   if (calleeName !== "_taggedTemplateLiteral") {
          //     return
          //   }
          //   const firstArgumentNode = node.arguments[0]
          //   if (firstArgumentNode.type !== "ArrayExpression") {
          //     return
          //   }
          //   const firstArrayElementNode = firstArgumentNode.elements[0]
          //   if (firstArrayElementNode.type !== "StringLiteral") {
          //     return
          //   }
          //   const raw = firstArrayElementNode.value
          //   const parentCallExpressionPath = path.findParent(
          //     (path) => path.node.type === "CallExpression",
          //   )
          //   if (!parentCallExpressionPath) {
          //     return
          //   }
          //   const parentCallee = parentCallExpressionPath.node.callee
          //   if (parentCallee.type !== "Identifier") {
          //     return
          //   }
          //   const tagName =
          //     getImportedName(parentCallExpressionPath, parentCallee.name) ||
          //     parentCallee.name
          //   if (tagName === "css") {
          //     inlineTemplateLiterals.push({
          //       contentType: "text/css",
          //       content: raw,
          //       ...getNodePosition(firstArrayElementNode),
          //       formatContent: (content) => `'${content}'`,
          //     })
          //   }
          // },
        })
        state.file.metadata.inlineContentCalls = inlineContentCalls
      },
    },
  }
}

const getNodePosition = (node) => {
  return {
    start: node.start,
    end: node.end,
    line: node.loc.start.line,
    column: node.loc.start.column,
    lineEnd: node.loc.end.line,
    columnEnd: node.loc.end.column,
  }
}

const getImportedName = (path, name) => {
  const binding = path.scope.getBinding(name)
  if (binding.path.type === "ImportSpecifier") {
    return binding.path.node.imported.name
  }
  return null
}
