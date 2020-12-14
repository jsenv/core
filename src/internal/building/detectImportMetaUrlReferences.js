import { require } from "@jsenv/core/src/internal/require.js"
import { referenceToCodeForRollup } from "./asset-builder.js"

const { asyncWalk } = require("estree-walker")
const MagicString = require("magic-string")

export const detectImportMetaUrlReferences = async ({
  url,
  // importerUrl,
  code,
  ast,
  assetBuilder,
}) => {
  const magicString = new MagicString(code)

  await asyncWalk(ast, {
    enter: async (node) => {
      if (!isNewUrlImportMetaUrl(node)) {
        return
      }
      const relativeUrl = node.arguments[0].value
      debugger

      const reference = await assetBuilder.createReferenceForAsset({
        referenceTargetSpecifier: relativeUrl,
        referenceUrl: url,
        // maybe we can get these info from node ?
        referenceLine: undefined,
        referenceColumn: undefined,
      })
      magicString.overwrite(
        node.arguments[0].start,
        node.arguments[0].end,
        referenceToCodeForRollup(reference),
      )
    },
  })

  return {
    code: magicString.toString(),
    map: magicString.generateMap(),
  }
}

const isNewUrlImportMetaUrl = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "URL" &&
    node.arguments.length === 2 &&
    node.arguments[0].type === "Literal" &&
    typeof node.arguments[0].value === "string" &&
    node.arguments[1].type === "MemberExpression" &&
    node.arguments[1].object.type === "MetaProperty" &&
    node.arguments[1].property.type === "Identifier" &&
    node.arguments[1].property.name === "url"
  )
}
