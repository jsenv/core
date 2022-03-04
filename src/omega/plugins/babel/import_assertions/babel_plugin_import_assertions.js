import { urlToRelativeUrl } from "@jsenv/filesystem"

import { injectQueryParams } from "@jsenv/core/src/utils/url_utils.js"
import { collectProgramUrlMentions } from "@jsenv/core/src/utils/js_ast/program_url_mentions.js"

export const babelPluginImportAssertions = (babel, { importTypes }) => {
  return {
    name: "transform-import-assertions",
    // During build we throw on import call expression where "specifier" or "type" is dynamic
    // Here there is no strong need to throw because keeping the source code intact
    // will throw an error when browser will execute the code
    visitor: {
      Program: (path) => {
        const urlMentions = collectProgramUrlMentions(path)
        urlMentions
          .filter(({ type }) => type === "js_import_export")
          .forEach(({ specifierPath, path }) => {
            const importNode = path.node
            if (importNode.type === "CallExpression") {
              const args = importNode.arguments
              const secondArg = args[1]
              if (!secondArg) {
                return
              }
              const { properties } = secondArg
              const assertProperty = properties.find((property) => {
                return property.key.name === "assert"
              })
              if (!assertProperty) {
                return
              }
              const assertProperties = assertProperty.value.properties
              const typePropertyNode = assertProperties.find((property) => {
                return property.key.name === "type"
              })
              if (!typePropertyNode) {
                return
              }
              const typePropertyValue = typePropertyNode.value
              if (typePropertyValue.type !== "StringLiteral") {
                return
              }

              const type = typePropertyValue.value
              if (importTypes.includes(type)) {
                forceImportTypeOnUrlSpecifier({
                  specifierPath,
                  babel,
                  importType: type,
                })
              }
              return
            }
            // ImportDeclaration
            const { assertions } = path.node
            if (assertions && assertions.length > 0) {
              const assertionsPath = path.get("assertions")[0]
              const assertionsDescriptor = {}
              assertions.forEach((importAssertion) => {
                assertionsDescriptor[importAssertion.key.name] =
                  importAssertion.value.value
              })
              const { type } = assertionsDescriptor
              if (importTypes.includes(type)) {
                forceImportTypeOnUrlSpecifier({
                  specifierPath,
                  babel,
                  importType: type,
                })
                assertionsPath.remove()
              }
            }
          })
      },
    },
  }
}

const forceImportTypeOnUrlSpecifier = ({
  specifierPath,
  babel,
  importType,
}) => {
  const specifier = specifierPath.node.value
  const fakeOrigin = "http://jsenv.com"
  const url = new URL(specifier, fakeOrigin)
  const urlWithImportType = injectQueryParams(url, {
    import_type: importType,
  })
  if (urlWithImportType.startsWith(fakeOrigin)) {
    // specifier was relative
    const specifierWithImportType = urlToRelativeUrl(
      urlWithImportType,
      fakeOrigin,
    )
    replaceUrlSpecifierUsingBabel(`./${specifierWithImportType}`, {
      specifierPath,
      babel,
    })
    return
  }
  replaceUrlSpecifierUsingBabel(urlWithImportType, {
    specifierPath,
    babel,
  })
}

const replaceUrlSpecifierUsingBabel = (value, { specifierPath, babel }) => {
  specifierPath.replaceWith(babel.types.stringLiteral(value))
}
