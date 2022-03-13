import { collectProgramUrlMentions } from "@jsenv/core/src/utils/js_ast/program_url_mentions.js"

import { applyBabelPlugins } from "@jsenv/core/src/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/core/src/utils/sourcemap/magic_source.js"

export const parseJsModuleUrlMentions = async ({ url, content }) => {
  const { metadata } = await applyBabelPlugins({
    babelPlugins: [
      [babelPluginMetadataUrlMentions],
      [babelPluginMetadataImportMetaHot],
    ],
    url,
    content,
  })
  const { urlMentions, hotDecline, hotAcceptSelf, hotAcceptDependencies } =
    metadata

  if (hotAcceptDependencies) {
    hotAcceptDependencies.forEach(({ specifierPath }) => {
      urlMentions.push({
        type: "import_meta_hot_accept_dependency",
        specifier: specifierPath.node.value,
        hotAccepted: true,
      })
    })
  }
  return {
    urlMentions,
    hotDecline,
    hotAcceptSelf,
    replaceUrls: async (replacements) => {
      const magicSource = createMagicSource({ url, content })
      Object.keys(replacements).forEach((url) => {
        const urlMention = urlMentions.find(
          (urlMention) => urlMention.url === url,
        )
        const { start, end } = urlMention
        magicSource.replace({
          start,
          end,
          replacement: replacements[url],
        })
      })
      return magicSource.toContentAndSourcemap()
    },
  }
}

const babelPluginMetadataUrlMentions = () => {
  return {
    name: "metadata-url-mentions",
    visitor: {
      Program(programPath, state) {
        const urlMentions = []
        collectProgramUrlMentions(programPath).forEach(
          ({ type, path, specifierPath }) => {
            const specifierNode = specifierPath.node
            if (specifierNode.type === "StringLiteral") {
              urlMentions.push({
                type,
                path,
                specifier: specifierNode.value,
                start: specifierNode.start,
                end: specifierNode.end,
                line: specifierNode.loc.start.line,
                column: specifierNode.loc.start.column,
              })
            }
          },
        )
        state.file.metadata.urlMentions = urlMentions
      },
    },
  }
}

// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

const babelPluginMetadataImportMetaHot = () => {
  return {
    name: "metadata-import-meta-hot",
    visitor: {
      Program(programPath) {
        const {
          hotDecline,
          hotAcceptSelf,
          hotAcceptDependencies = [],
        } = collectImportMetaProperties(programPath)
        Object.assign(this.file.metadata, {
          hotDecline,
          hotAcceptSelf,
          hotAcceptDependencies,
        })
      },
    },
  }
}
const collectImportMetaProperties = (programPath) => {
  const importMetaHotProperties = {}
  programPath.traverse({
    CallExpression(path) {
      if (isImportMetaHotMethodCall(path, "accept")) {
        const callNode = path.node
        const args = callNode.arguments
        if (args.length === 0) {
          importMetaHotProperties.hotAcceptSelf = true
          return
        }
        const firstArg = args[0]
        if (firstArg.type === "StringLiteral") {
          importMetaHotProperties.hotAcceptDependencies = [
            {
              specifierPath: path.get("arguments")[0],
            },
          ]
          return
        }
        if (firstArg.type === "ArrayExpression") {
          const firstArgPath = path.get("arguments")[0]
          importMetaHotProperties.hotAcceptDependencies = firstArg.elements.map(
            (arrayNode, index) => {
              if (arrayNode.type !== "StringLiteral") {
                throw new Error(
                  `all array elements must be strings in "import.meta.hot.accept(array)"`,
                )
              }
              return {
                specifierPath: firstArgPath.get(index),
              }
            },
          )
          return
        }
        // accept first arg can be "anything" such as
        // `const cb = () => {}; import.meta.accept(cb)`
        importMetaHotProperties.hotAcceptSelf = true
      }
      if (isImportMetaHotMethodCall(path, "decline")) {
        importMetaHotProperties.hotDecline = true
      }
    },
  })
  return importMetaHotProperties
}
const isImportMetaHotMethodCall = (path, methodName) => {
  const { property, object } = path.node.callee
  return (
    property &&
    property.name === methodName &&
    object &&
    object.property &&
    object.property.name === "hot" &&
    object.object.type === "MetaProperty"
  )
}
