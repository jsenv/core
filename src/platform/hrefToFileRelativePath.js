import { hrefToMeta } from "./hrefToMeta.js"

export const hrefToFileRelativePath = (href, { compileServerOrigin, compileIntoRelativePath }) => {
  const meta = hrefToMeta(href, { compileServerOrigin, compileIntoRelativePath })
  if (meta.type === "compile-server-compiled-file") return meta.ressource
  return ""
}
