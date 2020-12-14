// import { readFile, resolveUrl, urlToBasename } from "@jsenv/util"
// import { require } from "@jsenv/core/src/internal/require.js"

// const { asyncWalk } = require("estree-walker")
// const MagicString = require("magic-string")

// export const detectImportMetaUrlReferences = async ({ ast, code, importerUrl }) => {
//   const magicString = new MagicString(code)

// await asyncWalk(ast, {
//   enter: async (node) => {
//     if (!isNewUrlImportMetaUrl(node)) {
//       return
//     }
//     const assetRelativeUrl = node.arguments[0].value
//     const assetUrl = resolveUrl(importerUrl, assetRelativeUrl)
//     const assetName = urlToBasename(assetUrl)

//     const assetContents = await readFile(assetUrl)
//     const ref = this.emitFile({
//       type: "asset",
//       name: assetName,
//       source: assetContents,
//     })
//     magicString.overwrite(
//       node.arguments[0].start,
//       node.arguments[0].end,
//       `import.meta.ROLLUP_FILE_URL_${ref}`,
//     )
//   },
// })

//   return {
//     code: magicString.toString(),
//     map: magicString.generateMap(),
//   }
// }

// const isNewUrlImportMetaUrl = (node) => {
//   return (
//     node.type === "NewExpression" &&
//     node.callee.type === "Identifier" &&
//     node.callee.name === "URL" &&
//     node.arguments.length === 2 &&
//     node.arguments[0].type === "Literal" &&
//     typeof node.arguments[0].value === "string" &&
//     node.arguments[1].type === "MemberExpression" &&
//     node.arguments[1].object.type === "MetaProperty" &&
//     node.arguments[1].property.type === "Identifier" &&
//     node.arguments[1].property.name === "url"
//   )
// }
