export const createLocaters = ({ localRoot, remoteRoot, compileInto, compileId }) => {
  const remoteCompileRoot = `${remoteRoot}/${compileInto}/${compileId}`

  const remoteInstrumentRoot = `${remoteRoot}/${compileInto}/${compileId}-instrumented`

  const fileToRemoteCompiledFile = (file) => `${remoteCompileRoot}/${file}`

  const fileToRemoteInstrumentedFile = (file) => `${remoteInstrumentRoot}/${file}`

  const fileToRemoteSourceFile = (file) => `${remoteRoot}/${file}`

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
    fileToRemoteCompiledFile,
    fileToRemoteInstrumentedFile,
    fileToRemoteSourceFile,
    hrefToFile,
    hrefToLocalFile,
  }
}
