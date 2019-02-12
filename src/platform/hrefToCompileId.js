import { hrefToMeta } from "./hrefToMeta.js"

export const hrefToCompileId = (href, { compileInto, compileServerOrigin }) => {
  return hrefToMeta(href, { compileInto, compileServerOrigin }).compileId
}
