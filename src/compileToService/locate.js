export const locate = ({ projectFolder, compileInto, requestPathname }) => {
  if (requestPathname.startsWith(`/${compileInto}/`) === false) {
    return {
      compileId: null,
      filename: null,
    }
  }

  const afterCompileInto = requestPathname.slice(`/${compileInto}/`.length)
  const parts = afterCompileInto.split("/")

  const compileId = parts[0]
  if (compileId.length === 0) {
    return {
      compileId: null,
      filename: null,
    }
  }

  const filenameRelative = parts.slice(1).join("/")
  if (filenameRelative.length === 0) {
    return {
      compileId: null,
      filename: projectFolder,
    }
  }

  return {
    compileId,
    filename: `${projectFolder}/${filenameRelative}`,
  }
}
