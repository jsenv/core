import { hrefToPathname } from "@jsenv/module-resolution"
import { hrefToMeta } from "../../platform/hrefToMeta.js"

export const compiledHrefToCompiledFilename = (
  href,
  { compileServerOrigin, projectPathname, compileIntoRelativePath },
) => {
  const meta = hrefToMeta(href, { compileServerOrigin, compileIntoRelativePath })

  const sourceCompiledHref =
    meta.type === "compile-server-compiled-file"
      ? `file://${projectPathname}${compileIntoRelativePath}/${meta.compileId}${meta.ressource}`
      : href

  return hrefToPathname(sourceCompiledHref)
}
