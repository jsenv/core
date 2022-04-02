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
import { escapeString } from "@jsenv/utils/src/escape_string.js"

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
            replacement: escapeString(inlineUrlInfo.content, {
              quote: `'`,
              // allow internal quotes (needed for __v__)
              escapeInternalQuotes: false,
            }),
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
          NewExpression: (path) => {
            const newInlineContentCall = parseAsNewInlineContentCall(path.node)
            if (newInlineContentCall) {
              inlineContentCalls.push(newInlineContentCall)
            }
          },
        })
        state.file.metadata.inlineContentCalls = inlineContentCalls
      },
    },
  }
}

const parseAsNewInlineContentCall = (node) => {
  if (node.callee.type !== "Identifier") {
    return null
  }
  if (node.callee.name !== "InlineContent") {
    return null
  }
  if (node.arguments.length !== 2) {
    return null
  }
  const [firstArg, secondArg] = node.arguments
  if (secondArg.type !== "ObjectExpression") {
    return null
  }
  const typePropertyNode = secondArg.properties.find((property) => {
    return (
      property.key.type === "Identifier" &&
      property.key.name === "type" &&
      property.type === "ObjectProperty" &&
      property.value.type === "StringLiteral"
    )
  })
  if (!typePropertyNode) {
    return null
  }
  const type = typePropertyNode.value.value
  if (firstArg.type === "StringLiteral") {
    const useDoubleQuote = firstArg.extra.raw[0] === `"`
    if (useDoubleQuote) {
      // TODO: replace all single quote not escaped
    }
    const position = getNodePosition(firstArg)
    return {
      rawType: "StringLiteral",
      raw: firstArg.value,
      type,
      ...position,
    }
  }
  if (firstArg.type === "TemplateLiteral") {
    const quasis = firstArg.quasis
    if (quasis.length !== 1) {
      return null
    }
    const templateElementNode = quasis[0]
    const position = getNodePosition(firstArg)
    return {
      rawType: "TemplateLiteral",
      raw: templateElementNode.value.cooked,
      type,
      ...position,
    }
  }
  return null
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

// const getImportedName = (path, name) => {
//   const binding = path.scope.getBinding(name)
//   if (binding.path.type === "ImportSpecifier") {
//     return binding.path.node.imported.name
//   }
//   return null
// }
