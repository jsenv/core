import { filenameRelativeToSourceHref } from "./filenameRelativeToSourceHref.js"

export const hrefToSourceHref = (href, { compileServerOrigin }) => {
  if (!compileServerOrigin) return href

  if (!href.startsWith(`${compileServerOrigin}/`)) return href

  const filenameRelative = href.slice(`${compileServerOrigin}/`.length)
  return filenameRelativeToSourceHref({ filenameRelative, compileServerOrigin })
}
