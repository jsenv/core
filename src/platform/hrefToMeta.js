export const hrefToMeta = (href, { compileServerOrigin, compileIntoRelativePath }) => {
  if (href === compileServerOrigin) return { type: "compile-server-origin" }

  if (!href.startsWith(`${compileServerOrigin}/`)) return { type: "other", ressource: href }

  const pathname = href.slice(compileServerOrigin.length)
  if (!fileInsideFolder(pathname, compileIntoRelativePath)) {
    return {
      type: "compile-server-ressource",
      ressource: pathname,
    }
  }

  const pathAfterCompileInto = pathname.slice(compileIntoRelativePath.length + 1)
  const nextSlashIndex = pathAfterCompileInto.indexOf("/")

  if (nextSlashIndex === -1) {
    return {
      type: "compile-server-group-folder",
      compileId: pathAfterCompileInto,
      ressource: pathAfterCompileInto,
    }
  }

  const compileId = pathAfterCompileInto.slice(0, nextSlashIndex)
  const relativePath = pathAfterCompileInto.slice(nextSlashIndex)

  return {
    type: "compile-server-compiled-file",
    compileId,
    ressource: relativePath,
  }
}

const fileInsideFolder = (filename, foldername) => {
  return filename.startsWith(foldername)
}
