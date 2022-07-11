// some code capable to recoginize complex stuff, might be useful one day

// will not happen in practice because
// template literals support is good enough by default for jsenv
// default browser support
// CallExpression: (path) => {
//   const node = path.node
//   const callee = node.callee
//   if (callee.type !== "Identifier") {
//     return
//   }
//   const calleeName = getImportedName(path, callee.name) || callee.name
//   if (calleeName !== "_taggedTemplateLiteral") {
//     return
//   }
//   const firstArgumentNode = node.arguments[0]
//   if (firstArgumentNode.type !== "ArrayExpression") {
//     return
//   }
//   const firstArrayElementNode = firstArgumentNode.elements[0]
//   if (firstArrayElementNode.type !== "StringLiteral") {
//     return
//   }
//   const raw = firstArrayElementNode.value
//   const parentCallExpressionPath = path.findParent(
//     (path) => path.node.type === "CallExpression",
//   )
//   if (!parentCallExpressionPath) {
//     return
//   }
//   const parentCallee = parentCallExpressionPath.node.callee
//   if (parentCallee.type !== "Identifier") {
//     return
//   }
//   const tagName =
//     getImportedName(parentCallExpressionPath, parentCallee.name) ||
//     parentCallee.name
//   if (tagName === "css") {
//     inlineTemplateLiterals.push({
//       contentType: "text/css",
//       content: raw,
//       ...getNodePosition(firstArrayElementNode),
//       formatContent: (content) => `'${content}'`,
//     })
//   }
// },
