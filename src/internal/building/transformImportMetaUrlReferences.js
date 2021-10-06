import { resolveUrl } from "@jsenv/filesystem"

import { referenceToCodeForRollup } from "./ressource_builder.js"

export const transformImportMetaUrlReferences = async ({
  url,
  // importerUrl,
  code,
  ast,
  ressourceBuilder,
  markBuildRelativeUrlAsUsedByJs,
}) => {
  const { default: MagicString } = await import("magic-string")
  const magicString = new MagicString(code)

  const { asyncWalk } = await import("estree-walker")

  await asyncWalk(ast, {
    enter: async (node) => {
      if (!isNewUrlImportMetaUrl(node)) {
        return
      }
      const relativeUrl = node.arguments[0].value

      const ressourceUrl = resolveUrl(relativeUrl, url)

      const reference = await ressourceBuilder.createReferenceFoundInJsModule({
        jsUrl: url,
        ...(node.loc
          ? {
              jsLine: node.loc.start.line,
              jsColumn: node.loc.start.column,
            }
          : {}),

        ressourceSpecifier: ressourceUrl,
      })
      if (reference) {
        magicString.overwrite(
          node.start,
          node.end,
          referenceToCodeForRollup(reference),
        )
        markBuildRelativeUrlAsUsedByJs(reference.ressource.buildRelativeUrl)
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
