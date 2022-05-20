/*
 * Jsenv wont touch code where "specifier" or "type" is dynamic (see code below)
 * ```js
 * const file = "./style.css"
 * const type = "css"
 * import(file, { assert: { type }})
 * ```
 * Jsenv could throw an error when it knows some browsers in runtimeCompat
 * do not support import assertions
 * But for now (as it is simpler) we let the browser throw the error
 */

import { simple } from "acorn-walk"

import { parseJsWithAcorn } from "./parse_js_with_acorn.js"
import {
  isStringLiteralNode,
  getNodePosition,
} from "./js_static_analysis/helpers.js"

export const parseJsImportAssertions = ({ js, url }) => {
  const importAssertions = []
  if (!js.includes("assert")) {
    return importAssertions
  }
  const jsAst = parseJsWithAcorn({
    js,
    url,
    isJsModule: true,
  })
  simple(jsAst, {
    ImportDeclaration: (node) => {
      const { assertions } = node
      if (!assertions) {
        return
      }
      if (assertions.length === 0) {
        return
      }
      const typeAssertionNode = assertions.find(
        (assertion) => assertion.key.name === "type",
      )
      if (!typeAssertionNode) {
        return
      }
      const typeNode = typeAssertionNode.value
      if (isStringLiteralNode(typeNode)) {
        const type = typeNode.value
        importAssertions.push({
          type: "import_static",
          node,
          ...getNodePosition(node),
          specifier: node.source.value,
          specifierStart: node.source.start,
          specifierEnd: node.source.end,
          assertNode: typeAssertionNode,
          assert: {
            type,
          },
        })
      }
    },
    ImportExpression: (node) => {
      if (!isStringLiteralNode(node.source)) {
        // Non-string argument, probably a variable or expression, e.g.
        // import(moduleId)
        // import('./' + moduleName)
        return
      }
      const firstArgNode = node.arguments[0]
      if (!firstArgNode) {
        return
      }
      const { properties } = firstArgNode
      const assertProperty = properties.find((property) => {
        return property.key.name === "assert"
      })
      if (!assertProperty) {
        return
      }
      const assertValueNode = assertProperty.value
      if (assertValueNode.type !== "ObjectExpression") {
        return
      }
      const assertValueProperties = assertValueNode.properties
      const typePropertyNode = assertValueProperties.find((property) => {
        return property.key.name === "type"
      })
      if (!typePropertyNode) {
        return
      }
      const typePropertyValue = typePropertyNode.value
      if (!isStringLiteralNode(typePropertyValue)) {
        return
      }
      const type = typePropertyValue.value
      importAssertions.push({
        type: "import_dynamic",
        node,
        ...getNodePosition(node),
        specifier: node.source.value,
        specifierStart: node.source.start,
        specifierEnd: node.source.end,
        assertNode: firstArgNode,
        assert: {
          type,
        },
      })
    },
  })
  return importAssertions
}
