import { applyPostCss } from "./applyPostCss.js"
import { postCssUrlHashPlugin } from "./postcss-urlhash-plugin.js"

export const parseCssUrls = async (css, cssUrl = "file:///file.css") => {
  const atImports = []
  const urlDeclarations = []

  const postCssPlugins = [postCssUrlHashPlugin]
  const postCssOptions = { collectUrls: true }
  const result = await applyPostCss(css, cssUrl, postCssPlugins, postCssOptions)

  result.messages.forEach(
    ({ type, specifier, atImportNode, declarationNode, urlNode }) => {
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
    },
  )

  return { atImports, urlDeclarations }
}
