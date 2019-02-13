export const hrefToMeta = (href, { compileInto, compileServerOrigin }) => {
  if (href === compileServerOrigin) return { type: "compile-server-origin" }

  if (!href.startsWith(`${compileServerOrigin}/`)) return { type: "other", ressource: href }

  const pathname = href.slice(`${compileServerOrigin}/`.length)
  if (!fileInsideFolder(pathname, compileInto)) {
    return {
      type: "compile-server-ressource",
      ressource: pathname,
    }
  }

  const pathnameAfterCompileInto = pathname.slice(`${compileInto}/`.length)
  const nextSlashIndex = pathnameAfterCompileInto.indexOf("/")
  if (nextSlashIndex === -1) {
    return {
      type: "compile-server-group-folder",
      compileId: pathnameAfterCompileInto,
      ressource: pathnameAfterCompileInto,
    }
  }

  const compileId = pathnameAfterCompileInto.slice(0, nextSlashIndex)
  const filenameRelative = pathnameAfterCompileInto.slice(nextSlashIndex + 1)

  return {
    type: "compile-server-compiled-file",
    compileId,
    ressource: filenameRelative,
  }
}

const fileInsideFolder = (filename, foldername) => {
  return filename.startsWith(`${foldername}/`)
}
