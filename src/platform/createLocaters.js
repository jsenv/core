export const createLocaters = ({ localRoot, remoteRoot, compileInto, compileId }) => {
  const remoteCompileRoot = `${remoteRoot}/${compileInto}/${compileId}`

  const remoteInstrumentRoot = `${remoteRoot}/${compileInto}/${compileId}-instrumented`

  const fileToRemoteInstrumentedFile = (file) => `${remoteInstrumentRoot}/${file}`

  const fileToRemoteFile = (file, parent) => {
    if (parent) {
      const compileId = remoteFileToCompileId(parent)
      return `${remoteRoot}/${compileInto}/${compileId}/${file}`
    }
    return `${remoteRoot}/${compileInto}/${compileId}/${file}`
  }

  const remoteFileToCompileId = (file) => {
    const afterCompileFolder = file.slice(`${remoteRoot}/${compileInto}/`.length)
    return afterCompileFolder.slice(0, afterCompileFolder.indexOf("/"))
  }

  const fileToRemoteSourceFile = (file) => `${remoteRoot}/${file}`

  const fileToLocalFile = (file) => `${localRoot}/${file}`

  const hrefToMeta = (href) => {
    if (href.startsWith(`${remoteInstrumentRoot}/`)) {
      return {
        type: "instrumented",
        file: href.slice(remoteInstrumentRoot.length + 1),
      }
    }
    if (href.startsWith(`${remoteCompileRoot}/`)) {
      return {
        type: "compiled",
        file: href.slice(remoteCompileRoot.length + 1),
      }
    }
    if (href.startsWith(`${remoteRoot}/${compileInto}`)) {
      return {
        type: "compile-helper",
        file: href.slice(remoteRoot.length + 1),
      }
    }
    if (href.startsWith(`${remoteRoot}/`)) {
      return {
        type: "source",
        file: href.slice(remoteRoot.length + 1),
      }
    }
    return {
      type: "other",
      file: href,
    }
  }

  const hrefToFile = (href) => hrefToMeta(href).file

  const hrefToLocalFile = (href) => {
    const { type, file } = hrefToMeta(href)
    if (type === "instrumented") {
      return `${localRoot}/${compileInto}/${compileId}-instrumented/${file}`
    }
    if (type === "compiled") {
      return `${localRoot}/${compileInto}/${compileId}/${file}`
    }
    return `${localRoot}/${file}`
  }

  return {
    fileToRemoteFile,
    fileToRemoteInstrumentedFile,
    fileToRemoteSourceFile,
    fileToLocalFile,
    hrefToFile,
    hrefToLocalFile,
  }
}
