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

import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { JS_QUOTES } from "@jsenv/utils/string/js_quotes.js"
import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { generateInlineContentUrl } from "@jsenv/utils/urls/inline_content_url_generator.js"

export const jsenvPluginNewInlineContent = ({ allowEscapeForVersioning }) => {
  return {
    name: "jsenv:new_inline_content",
    appliesDuring: "*",
    transform: {
      js_module: async (
        { url, generatedUrl, content, originalContent },
        { referenceUtils, cook, isSupportedOnRuntime },
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
              "application/json": ".json",
              "text/css": ".css",
              "text/plain": ".txt",
              "application/octet-stream": "",
            }[inlineContentCall.contentType],
            line: inlineContentCall.line,
            column: inlineContentCall.column,
            lineEnd: inlineContentCall.lineEnd,
            columnEnd: inlineContentCall.columnEnd,
          })
          let { quote } = inlineContentCall
          if (
            quote === "`" &&
            !isSupportedOnRuntime("transform-template-literals")
          ) {
            // if quote is "`" and template literals are not supported
            // we'll use a regular string (single or double quote)
            // when rendering the string
            quote = JS_QUOTES.pickBest(inlineContentCall.content)
          }
          const [inlineReference, inlineUrlInfo] = referenceUtils.foundInline({
            type: "js_inline_content",
            isOriginal: content === originalContent,
            line: inlineContentCall.line,
            column: inlineContentCall.column,
            specifier: inlineUrl,
            contentType: inlineContentCall.contentType,
            content: inlineContentCall.content,
          })
          inlineUrlInfo.jsQuote = quote
          inlineReference.escape = (value) =>
            JS_QUOTES.escapeSpecialChars(value, { quote })
          await cook({
            reference: inlineReference,
            urlInfo: inlineUrlInfo,
          })
          magicSource.replace({
            start: inlineContentCall.start,
            end: inlineContentCall.end,
            replacement: `${quote}${JS_QUOTES.escapeSpecialChars(
              inlineUrlInfo.content,
              {
                quote,
                allowEscapeForVersioning,
              },
            )}${quote}`,
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
    const position = getNodePosition(firstArg)
    return {
      nodeType: "StringLiteral",
      quote: firstArg.extra.raw[0],
      contentType: type,
      content: firstArg.value,
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
      nodeType: "TemplateLiteral",
      quote: "`",
      contentType: type,
      content: templateElementNode.value.cooked,
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
