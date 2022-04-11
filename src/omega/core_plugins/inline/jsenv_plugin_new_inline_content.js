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
          babelPlugins: [babelPluginMetadataInlineContentCalls],
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
            JS_QUOTES.escapeSpecialChars(value.slice(1, -1), { quote })
          await cook({
            reference: inlineReference,
            urlInfo: inlineUrlInfo,
          })
          magicSource.replace({
            start: inlineContentCall.start,
            end: inlineContentCall.end,
            replacement: JS_QUOTES.escapeSpecialChars(inlineUrlInfo.content, {
              quote,
              allowEscapeForVersioning,
            }),
          })
        }, Promise.resolve())
        return magicSource.toContentAndSourcemap()
      },
    },
  }
}

const babelPluginMetadataInlineContentCalls = () => {
  return {
    name: "metadata-inline-content-calls",
    visitor: {
      Program: (programPath, state) => {
        const inlineContentCalls = []
        programPath.traverse({
          NewExpression: (path) => {
            const newInlineContentCall = parseAsNewInlineContentCall(path)
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

const parseAsNewInlineContentCall = (path) => {
  const node = path.node
  if (node.callee.type === "Identifier") {
    // terser rename import to use a shorter name
    const name = getOriginalName(path, node.callee.name)
    if (name !== "InlineContent") {
      return null
    }
  } else if (node.callee.id) {
    // terser might combine new InlineContent('') declaration and usage
    if (node.callee.id.type !== "Identifier") {
      return null
    }
    const name = getOriginalName(path, node.callee.id.name)
    if (name !== "InlineContent") {
      return null
    }
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

const getOriginalName = (path, name) => {
  const binding = path.scope.getBinding(name)
  if (!binding) {
    return name
  }
  if (binding.path.type === "ImportSpecifier") {
    const importedName = binding.path.node.imported.name
    if (name === importedName) {
      return name
    }
    return getOriginalName(path, importedName)
  }
  if (binding.path.type === "VariableDeclarator") {
    if (binding.path.node.init.type === "Identifier") {
      const previousName = binding.path.node.init.name
      return getOriginalName(path, previousName)
    }
  }
  return name
}
