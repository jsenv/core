import { urlToFileSystemPath } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"
import { postCssUrlHashPlugin } from "./postcss-urlhash-plugin.js"

const postcss = require("postcss")

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
