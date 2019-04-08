import { hrefToPathname } from "@jsenv/module-resolution"
import { hrefToMeta } from "../hrefToMeta.js"

export const compiledHrefToCompiledFilename = (
  href,
  { compileInto, sourceOrigin, compileServerOrigin },
) => {
  const meta = hrefToMeta(href, { compileInto, compileServerOrigin })

  const sourceCompiledHref =
    meta.type === "compile-server-compiled-file"
      ? `${sourceOrigin}/${compileInto}/${meta.compileId}/${meta.ressource}`
      : href

  return hrefToPathname(sourceCompiledHref)
}
