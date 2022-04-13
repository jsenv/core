import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { JS_QUOTES } from "@jsenv/utils/string/js_quotes.js"
import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { generateInlineContentUrl } from "@jsenv/utils/urls/inline_content_url_generator.js"

export const jsenvPluginContentInsideJs = ({ allowEscapeForVersioning }) => {
  return {
    name: "jsenv:content_inside_js",
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
          if (quote === "`" && !isSupportedOnRuntime("template_literals")) {
            // if quote is "`" and template literals are not supported
            // we'll use a regular string (single or double quote)
            // when rendering the string
            quote = JS_QUOTES.pickBest(inlineContentCall.content)
          }
          const [inlineReference, inlineUrlInfo] = referenceUtils.foundInline({
            type: inlineContentCall.type,
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
            const inlineContentCall = parseAsInlineContentCall(path)
            if (inlineContentCall) {
              inlineContentCalls.push(inlineContentCall)
              return
            }
          },
        })
        state.file.metadata.inlineContentCalls = inlineContentCalls
      },
    },
  }
}

const parseAsInlineContentCall = (path) => {
  const identifier = parseNewIdentifier(path)
  if (!identifier) {
    return null
  }
  const node = path.node
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
  const type = identifier.type
  const contentType = typePropertyNode.value.value
  let nodeHoldingInlineContent
  if (type === "js_new_inline_content") {
    nodeHoldingInlineContent = firstArg
  } else if (type === "js_new_blob") {
    if (firstArg.type !== "ArrayExpression") {
      return null
    }
    if (firstArg.elements.length !== 1) {
      return null
    }
    nodeHoldingInlineContent = firstArg.elements[0]
  }
  const inlineContentInfo = extractInlineContentInfo(nodeHoldingInlineContent)
  if (!inlineContentInfo) {
    return null
  }
  return {
    type,
    contentType,
    ...inlineContentInfo,
    ...getNodePosition(nodeHoldingInlineContent),
  }
}

const extractInlineContentInfo = (node) => {
  if (node.type === "StringLiteral") {
    return {
      nodeType: "StringLiteral",
      quote: node.extra.raw[0],
      content: node.value,
    }
  }
  if (node.type === "TemplateLiteral") {
    const quasis = node.quasis
    if (quasis.length !== 1) {
      return null
    }
    const templateElementNode = quasis[0]
    return {
      nodeType: "TemplateLiteral",
      quote: "`",
      content: templateElementNode.value.cooked,
    }
  }
  return null
}

const parseNewIdentifier = (path) => {
  const node = path.node
  if (node.callee.type === "Identifier") {
    // terser rename import to use a shorter name
    const name = getOriginalName(path, node.callee.name)
    if (name === "InlineContent") {
      return {
        type: "js_new_inline_content",
      }
    }
    if (name === "Blob") {
      return {
        type: "js_new_blob",
      }
    }
    return null
  }
  if (node.callee.id) {
    // terser might combine new InlineContent('') declaration and usage
    if (node.callee.id.type !== "Identifier") {
      return null
    }
    const name = getOriginalName(path, node.callee.id.name)
    if (name === "InlineContent") {
      return {
        type: "js_new_inline_content",
      }
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
