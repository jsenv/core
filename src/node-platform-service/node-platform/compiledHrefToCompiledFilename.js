import { hrefToPathname } from "@jsenv/module-resolution"
import { hrefToMeta } from "../../platform/hrefToMeta.js"

export const compiledHrefToCompiledFilename = (
  href,
  { projectFolder, compileServerOrigin, compileInto },
) => {
  const meta = hrefToMeta(href, { compileInto, compileServerOrigin })

  const sourceCompiledHref =
    meta.type === "compile-server-compiled-file"
      ? `file://${projectFolder}/${compileInto}/${meta.compileId}/${meta.ressource}`
      : href

  return hrefToPathname(sourceCompiledHref)
}
