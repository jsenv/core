import { CONTENT_TYPE } from "@jsenv/utils/content_type/content_type.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { JS_QUOTES } from "@jsenv/utils/string/js_quotes.js"
import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { generateInlineContentUrl } from "@jsenv/utils/urls/inline_content_url_generator.js"

export const jsenvPluginJsInlineContent = ({ allowEscapeForVersioning }) => {
  const parseAndTransformInlineContentCalls = async (urlInfo, context) => {
    const inlineContentInfos = await parseJsInlineContentInfos({
      js: urlInfo.content,
      url: urlInfo.originalUrl,
      isJsModule: urlInfo.type === "js_module",
    })
    if (inlineContentInfos.length === 0) {
      return null
    }
    const magicSource = createMagicSource(urlInfo.content)
    await inlineContentInfos.reduce(async (previous, inlineContentInfo) => {
      await previous
      const inlineUrl = generateInlineContentUrl({
        url: urlInfo.url,
        extension: CONTENT_TYPE.asFileExtension(inlineContentInfo.contentType),
        line: inlineContentInfo.line,
        column: inlineContentInfo.column,
        lineEnd: inlineContentInfo.lineEnd,
        columnEnd: inlineContentInfo.columnEnd,
      })
      let { quote } = inlineContentInfo
      if (
        quote === "`" &&
        !context.isSupportedOnCurrentClients("template_literals")
      ) {
        // if quote is "`" and template literals are not supported
        // we'll use a regular string (single or double quote)
        // when rendering the string
        quote = JS_QUOTES.pickBest(inlineContentInfo.content)
      }
      const [inlineReference, inlineUrlInfo] =
        context.referenceUtils.foundInline({
          type: "js_inline_content",
          subtype: inlineContentInfo.type, // "new_blob_first_arg", "new_inline_content_first_arg", "json_parse_first_arg"
          isOriginalPosition: urlInfo.content === urlInfo.originalContent,
          specifierLine: inlineContentInfo.line,
          specifierColumn: inlineContentInfo.column,
          specifier: inlineUrl,
          contentType: inlineContentInfo.contentType,
          content: inlineContentInfo.content,
        })
      inlineUrlInfo.jsQuote = quote
      inlineReference.escape = (value) =>
        JS_QUOTES.escapeSpecialChars(value.slice(1, -1), { quote })
      await context.cook(inlineUrlInfo, { reference: inlineReference })
      magicSource.replace({
        start: inlineContentInfo.start,
        end: inlineContentInfo.end,
        replacement: JS_QUOTES.escapeSpecialChars(inlineUrlInfo.content, {
          quote,
          allowEscapeForVersioning,
        }),
      })
    }, Promise.resolve())
    return magicSource.toContentAndSourcemap()
  }

  return {
    name: "jsenv:js_inline_content",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: parseAndTransformInlineContentCalls,
      js_module: parseAndTransformInlineContentCalls,
    },
  }
}

const parseJsInlineContentInfos = async ({ js, url, isJsModule }) => {
  if (
    !js.includes("InlineContent") &&
    !js.includes("new Blob(") &&
    !js.includes("JSON.parse(")
  ) {
    return []
  }
  const { metadata } = await applyBabelPlugins({
    babelPlugins: [babelPluginMetadataInlineContents],
    urlInfo: {
      originalUrl: url,
      type: isJsModule ? "js_module" : "js_classic",
      content: js,
    },
  })
  return metadata.inlineContentInfos
}

const babelPluginMetadataInlineContents = () => {
  return {
    name: "metadata-inline-contents",
    visitor: {
      Program: (programPath, state) => {
        const inlineContentInfos = []
        const onInlineContentInfo = (inlineContentInfo) => {
          inlineContentInfos.push(inlineContentInfo)
        }
        programPath.traverse({
          NewExpression: (path) => {
            if (isNewInlineContentCall(path)) {
              analyzeNewInlineContentCall(path.node, {
                onInlineContentInfo,
              })
              return
            }
            if (isNewBlobCall(path.node)) {
              analyzeNewBlobCall(path.node, {
                onInlineContentInfo,
              })
              return
            }
          },
          CallExpression: (path) => {
            const node = path.node
            if (isJSONParseCall(node)) {
              analyzeJsonParseCall(node, {
                onInlineContentInfo,
              })
            }
          },
        })
        state.file.metadata.inlineContentInfos = inlineContentInfos
      },
    },
  }
}

const isNewInlineContentCall = (path) => {
  const node = path.node
  if (node.callee.type === "Identifier") {
    // terser rename import to use a shorter name
    const name = getOriginalName(path, node.callee.name)
    return name === "InlineContent"
  }
  if (node.callee.id && node.callee.id.type === "Identifier") {
    const name = getOriginalName(path, node.callee.id.name)
    return name === "InlineContent"
  }
  return false
}
const analyzeNewInlineContentCall = (node, { onInlineContentInfo }) => {
  analyzeArguments({
    node,
    onInlineContentInfo,
    nodeHoldingContent: node.arguments[0],
    type: "new_inline_content_first_arg",
  })
}

const isNewBlobCall = (node) => {
  return node.callee.type === "Identifier" && node.callee.name === "Blob"
}
const analyzeNewBlobCall = (node, { onInlineContentInfo }) => {
  const firstArg = node.arguments[0]
  if (firstArg.type !== "ArrayExpression") {
    return
  }
  if (firstArg.elements.length !== 1) {
    return
  }
  analyzeArguments({
    node,
    onInlineContentInfo,
    nodeHoldingContent: firstArg.elements[0],
    type: "new_blob_first_arg",
  })
}

const analyzeArguments = ({
  node,
  onInlineContentInfo,
  nodeHoldingContent,
  type,
}) => {
  if (node.arguments.length !== 2) {
    return
  }
  const [, secondArg] = node.arguments
  const typePropertyNode = getTypePropertyNode(secondArg)
  if (!typePropertyNode) {
    return
  }
  const typePropertyValueNode = typePropertyNode.value
  if (typePropertyValueNode.type !== "StringLiteral") {
    return
  }
  const contentType = typePropertyValueNode.value
  const contentDetails = extractContentDetails(nodeHoldingContent)
  if (contentDetails) {
    onInlineContentInfo({
      node: nodeHoldingContent,
      ...getNodePosition(nodeHoldingContent),
      type,
      contentType,
      ...contentDetails,
    })
  }
}
const extractContentDetails = (node) => {
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

const isJSONParseCall = (node) => {
  const callee = node.callee
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "JSON" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "parse"
  )
}
const analyzeJsonParseCall = (node, { onInlineContentInfo }) => {
  const firstArgNode = node.arguments[0]
  const contentDetails = extractContentDetails(firstArgNode)
  if (contentDetails) {
    onInlineContentInfo({
      node: firstArgNode,
      ...getNodePosition(firstArgNode),
      type: "json_parse_first_arg",
      contentType: "application/json",
      ...contentDetails,
    })
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
    const { init } = binding.path.node
    if (init && init.type === "Identifier") {
      const previousName = init.name
      return getOriginalName(path, previousName)
    }
  }
  return name
}
const getTypePropertyNode = (node) => {
  if (node.type !== "ObjectExpression") {
    return null
  }
  const { properties } = node
  return properties.find((property) => {
    return (
      property.type === "ObjectProperty" &&
      property.key.type === "Identifier" &&
      property.key.name === "type"
    )
  })
}
