import { urlToRelativeUrl } from "@jsenv/filesystem"

import { injectQuery } from "@jsenv/core/src/internal/url_utils.js"

import { collectProgramUrlReferences } from "@jsenv/core/src/internal/transform_js/program_url_references.js"

export const babelPluginImportAssertions = (
  babel,
  { transformJson = true, transformCss = true },
) => {
  return {
    name: "transform-import-assertions",
    // During build we throw on import call expression where "specifier" or "type" is dynamic
    // Here there is no strong need to throw because keeping the source code intact
    // will throw an error when browser will execute the code
    visitor: {
      Program: (path) => {
        const urlReferences = collectProgramUrlReferences(path)
        urlReferences
          .filter(({ type }) => type === "import_exports")
          .forEach(({ urlSpecifierPath, path }) => {
            const importNode = path.node
            let assertionsDescriptor
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
              assertionsDescriptor = {
                type: typePropertyValue.value,
              }
            } else {
              assertionsDescriptor = getImportAssertionsDescriptor(
                path.node.assertions,
              )
            }
            const { type } = assertionsDescriptor
            if (type === "json" && transformJson) {
              forceImportTypeOnSpecifier({
                urlSpecifierPath,
                babel,
                importType: "json",
              })
              return
            }
            if (type === "css" && transformCss) {
              forceImportTypeOnSpecifier({
                urlSpecifierPath,
                babel,
                importType: "css",
              })
              return
            }
          })
      },
    },
  }
}

const getImportAssertionsDescriptor = (importAssertions) => {
  const importAssertionsDescriptor = {}
  if (importAssertions) {
    importAssertions.forEach((importAssertion) => {
      importAssertionsDescriptor[importAssertion.key.name] =
        importAssertion.value.value
    })
  }
  return importAssertionsDescriptor
}

const forceImportTypeOnSpecifier = ({
  urlSpecifierPath,
  babel,
  importType,
}) => {
  const specifier = urlSpecifierPath.node.value
  const fakeOrigin = "http://jsenv.com"
  const url = new URL(specifier, fakeOrigin)
  const urlWithImportType = injectQuery(url, {
    import_type: importType,
  })
  if (urlWithImportType.startsWith(fakeOrigin)) {
    // specifier was relative
    const specifierWithImportType = urlToRelativeUrl(
      urlWithImportType,
      fakeOrigin,
    )

    replaceSpecifierUsingBabel(`./${specifierWithImportType}`, {
      urlSpecifierPath,
      babel,
    })
    return
  }

  replaceSpecifierUsingBabel(urlWithImportType, {
    urlSpecifierPath,
    babel,
  })
}

const replaceSpecifierUsingBabel = (value, { urlSpecifierPath, babel }) => {
  urlSpecifierPath.replaceWith(babel.types.stringLiteral(value))
}
