export const hrefToMeta = (href, { compileInto, compileServerOrigin }) => {
  if (href === compileServerOrigin) return { type: "compile-server-origin" }

  if (!href.startsWith(`${compileServerOrigin}/`)) return { type: "other", ressource: href }

  const nameRelativeToCompileServerOrigin = href.slice(`${compileServerOrigin}/`.length)
  if (!fileInsideFolder(nameRelativeToCompileServerOrigin, compileInto)) {
    return {
      type: "compile-server-ressource",
      ressource: nameRelativeToCompileServerOrigin,
    }
  }

  const nameRelativeToCompileInto = nameRelativeToCompileServerOrigin.slice(
    `${compileInto}/`.length,
  )
  const nextSlashIndex = nameRelativeToCompileInto.indexOf("/")
  if (nextSlashIndex === -1) {
    return {
      type: "compile-server-group-folder",
      compileId: nameRelativeToCompileInto,
      ressource: nameRelativeToCompileInto,
    }
  }

  const compileId = nameRelativeToCompileInto.slice(0, nextSlashIndex)
  const nameRelativeToCompileGroup = nameRelativeToCompileInto.slice(nextSlashIndex + 1)

  return {
    type: "compile-server-compiled-file",
    compileId,
    ressource: nameRelativeToCompileGroup,
  }
}

const fileInsideFolder = (filename, foldername) => {
  return filename.startsWith(`${foldername}/`)
}
