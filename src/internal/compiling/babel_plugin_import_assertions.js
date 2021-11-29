import { urlToRelativeUrl } from "@jsenv/filesystem"

import { setUrlSearchParamsDescriptor } from "@jsenv/core/src/internal/url_utils.js"
import { babelPluginImportVisitor } from "./babel_plugin_import_visitor.js"

export const babelPluginImportAssertions = (
  babel,
  { transformJson = true, transformCss = true },
) => {
  return {
    ...babelPluginImportVisitor(
      babel,
      // During build we throw on import call expression where "specifier" or "type" is dynamic
      // Here there is no strong need to throw because keeping the source code intact
      // will throw an error when browser will execute the code
      ({ importPath, specifierPath }) => {
        const importNode = importPath.node
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
            importPath.node.assertions,
          )
        }

        const { type } = assertionsDescriptor
        if (type === "json" && transformJson) {
          forceImportTypeOnSpecifier({
            specifierPath,
            babel,
            importType: "json",
          })
          return
        }

        if (type === "css" && transformCss) {
          forceImportTypeOnSpecifier({
            specifierPath,
            babel,
            importType: "css",
          })
          return
        }
      },
    ),
    name: "transform-import-assertions",
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

const forceImportTypeOnSpecifier = ({ specifierPath, babel, importType }) => {
  const specifier = specifierPath.node.value
  const fakeOrigin = "http://jsenv.com"
  const url = new URL(specifier, fakeOrigin)
  const urlWithImportType = setUrlSearchParamsDescriptor(url, {
    import_type: importType,
  })
  if (urlWithImportType.startsWith(fakeOrigin)) {
    // specifier was relative
    const specifierWithImportType = urlToRelativeUrl(
      urlWithImportType,
      fakeOrigin,
    )

    replaceSpecifierUsingBabel(`./${specifierWithImportType}`, {
      specifierPath,
      babel,
    })
    return
  }

  replaceSpecifierUsingBabel(urlWithImportType, {
    specifierPath,
    babel,
  })
}

const replaceSpecifierUsingBabel = (value, { specifierPath, babel }) => {
  specifierPath.replaceWith(babel.types.stringLiteral(value))
}
