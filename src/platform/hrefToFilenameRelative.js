import { hrefToMeta } from "./hrefToMeta.js"

export const hrefToFilenameRelative = (href, { compileInto, compileServerOrigin }) =>
  hrefToMeta(href, { compileInto, compileServerOrigin }).filenameRelative
