import { hrefToMeta } from "./hrefToMeta.js"

export const hrefToFilenameRelative = (href, { compileInto, compileServerOrigin }) => {
  const meta = hrefToMeta(href, { compileInto, compileServerOrigin })
  if (meta.type === "compile-server-compiled-file") return meta.ressource
  return ""
}
