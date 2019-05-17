import { hrefToMeta } from "./hrefToMeta.js"

export const hrefToFileRelativePath = (href, { compileIntoRelativePath, compileServerOrigin }) => {
  const meta = hrefToMeta(href, { compileIntoRelativePath, compileServerOrigin })
  if (meta.type === "compile-server-compiled-file") return meta.ressource
  return ""
}
