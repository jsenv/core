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

  const pathAfterCompileFolder = pathname.slice(compileIntoRelativePath.length)
  const nextSlashIndex = pathAfterCompileFolder.indexOf("/")
  if (nextSlashIndex === -1) {
    return {
      type: "compile-server-group-folder",
      compileId: pathAfterCompileFolder,
      ressource: pathAfterCompileFolder,
    }
  }

  const compileId = pathAfterCompileFolder.slice(0, nextSlashIndex)
  const path = pathAfterCompileFolder.slice(nextSlashIndex)

  return {
    type: "compile-server-compiled-file",
    compileId,
    ressource: path,
  }
}

const fileInsideFolder = (filename, foldername) => {
  return filename.startsWith(foldername)
}
