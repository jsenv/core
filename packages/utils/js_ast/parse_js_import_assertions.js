/*
 * Jsenv wont touch code where "specifier" or "type" is dynamic (see code below)
 * ```js
 * const file ="./style.css"
 * const type = "css"
 * import(file, { assert: { type }})
 * ```
 * Jsenv could throw an error because we know browser will fail to execute the code
 * because import assertions are not supported.
 * But for now (as it is simpler to do so) we let the browser throw the error
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
          node,
          ...getNodePosition(node),
          assertNode: typeAssertionNode,
          type: "import_static",
          specifier: node.source.value,
          specifierStart: node.source.start,
          specifierEnd: node.source.end,
          assert: {
            type,
          },
        })
      }
    },
    CallExpression: (node) => {
      if (node.callee.type !== "Import") {
        // Some other function call, not import();
        return
      }
      const args = node.arguments
      const [firstArgNode, secondArgNode] = args
      if (isStringLiteralNode(firstArgNode)) {
        // Non-string argument, probably a variable or expression, e.g.
        // import(moduleId)
        // import('./' + moduleName)
        return
      }
      if (!secondArgNode) {
        return
      }
      const { properties } = secondArgNode
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
      if (isStringLiteralNode(typePropertyValue)) {
        return
      }
      const type = typePropertyValue.value
      importAssertions.push({
        node,
        ...getNodePosition(node),
        specifier: firstArgNode.value,
        specifierStart: firstArgNode.start,
        specifierEnd: firstArgNode.end,
        assertNode: secondArgNode,
        assert: {
          type,
        },
      })
    },
  })
  return importAssertions
}
