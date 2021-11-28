import { applyPostCss } from "./applyPostCss.js"
import { postCssPluginUrlVisitor } from "./postcss_plugin_url_visitor.js"

export const parseCssUrls = async ({ code, url = "file:///file.css" }) => {
  const atImports = []
  const urlDeclarations = []
  await applyPostCss({
    code,
    url,
    plugins: [
      postCssPluginUrlVisitor({
        urlVisitor: ({
          type,
          specifier,
          atImportNode,
          declarationNode,
          urlNode,
        }) => {
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
      }),
    ],
  })
  return { atImports, urlDeclarations }
}
