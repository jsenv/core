import { resolveUrl } from "@jsenv/util"

import { require } from "@jsenv/core/src/internal/require.js"
import { referenceToCodeForRollup } from "./asset-builder.js"

export const transformImportMetaUrlReferences = async ({
  url,
  // importerUrl,
  code,
  ast,
  assetBuilder,
  fetch,
  markBuildRelativeUrlAsUsedByJs,
}) => {
  const MagicString = require("magic-string")
  const magicString = new MagicString(code)

  const { asyncWalk } = await import("estree-walker")

  await asyncWalk(ast, {
    enter: async (node) => {
      if (!isNewUrlImportMetaUrl(node)) {
        return
      }
      const relativeUrl = node.arguments[0].value

      // hum on devrait le fetch pour obtenir l'url finale et le content-type
      // par contre on y applique pas les import map
      const targetUrl = resolveUrl(relativeUrl, url)
      const response = await fetch(targetUrl, url)
      const targetBuffer = Buffer.from(await response.arrayBuffer())

      const reference = await assetBuilder.createReferenceForJs({
        jsUrl: url,
        ...(node.loc
          ? {
              jsLine: node.loc.start.line,
              jsColumn: node.loc.start.column,
            }
          : {}),

        targetSpecifier: response.url,
        targetContentType: response.headers["content-type"],
        targetBuffer,
      })
      if (reference) {
        magicString.overwrite(
          node.arguments[0].start,
          node.arguments[0].end,
          referenceToCodeForRollup(reference),
        )
        markBuildRelativeUrlAsUsedByJs(reference.target.targetBuildRelativeUrl)
      }
    },
  })

  const codeOutput = magicString.toString()
  const map = magicString.generateMap({ hires: true })

  return {
    code: codeOutput,
    map,
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
