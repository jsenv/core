import postcss from "postcss"
import { urlToFileSystemPath } from "@jsenv/util"
import { postCssUrlHashPlugin } from "./postcss-urlhash-plugin.js"

export const parseCssUrls = async (css, cssFileUrl) => {
  const atImports = []
  const urlDeclarations = []

  let result
  try {
    result = await postcss([postCssUrlHashPlugin]).process(css, {
      collectUrls: true,
      from: urlToFileSystemPath(cssFileUrl),
    })
  } catch (error) {
    if (error.name === "CssSyntaxError") {
      console.error(String(error))
      throw error
    }
    throw error
  }

  result.messages.forEach(({ type, specifier, atImportNode, declarationNode, urlNode }) => {
    if (type === "import") {
      atImports.push({
        specifier,
        urlNode,
        urlDeclarationNode: atImportNode,
      })
    }
    if (type === "asset") {
      urlDeclarations.push({
        specifier,
        urlNode,
        urlDeclarationNode: declarationNode,
      })
    }
  })

  return { atImports, urlDeclarations }
}
