import { urlToRelativeUrl } from "@jsenv/filesystem"

import { setUrlSearchParamsDescriptor } from "@jsenv/core/src/internal/url_utils.js"
import { babelPluginTransformImportSpecifier } from "./babel_plugin_transform_import_specifier.js"

export const babelPluginImportAssertions = (
  babel,
  { transformJson = true, transformCss = true },
) => {
  return {
    ...babelPluginTransformImportSpecifier(babel, {
      // During the build we throw when for import call expression where
      // sepcifier or type is dynamic.
      // Here there is no strong need to throw because keeping the source code intact
      // will throw an error when browser will execute the code
      transformImportSpecifier: ({ specifier, path }) => {
        const importPath = path.parentPath
        const importNode = importPath.node
        let assertionsDescriptor
        if (importNode.type === "CallExpression") {
          const args = importNode.arguments
          const secondArg = args[1]
          if (!secondArg) {
            return specifier
          }

          const { properties } = secondArg
          const assertProperty = properties.find((property) => {
            return property.key.name === "assert"
          })
          if (!assertProperty) {
            return specifier
          }

          const assertProperties = assertProperty.value.properties
          const typePropertyNode = assertProperties.find((property) => {
            return property.key.name === "type"
          })
          if (!typePropertyNode) {
            return specifier
          }

          const typePropertyValue = typePropertyNode.value
          if (typePropertyValue.type !== "StringLiteral") {
            return specifier
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
          return forceImportTypeOnSpecifier(specifier, "json")
        }

        if (type === "css" && transformCss) {
          return forceImportTypeOnSpecifier(specifier, "css")
        }

        return specifier
      },
    }),

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

const forceImportTypeOnSpecifier = (specifier, importType) => {
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
    return `./${specifierWithImportType}`
  }
  return urlWithImportType
}
