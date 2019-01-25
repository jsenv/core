export const ressourceToRemoteCompiledFile = ({ ressource, remoteRoot, compileInto, compileId }) =>
  `${getRemoteCompiledFolder({ remoteRoot, compileInto, compileId })}/${ressource}`

export const ressourceToRemoteInstrumentedFile = ({
  ressource,
  remoteRoot,
  compileInto,
  compileId,
}) => `${getRemoteInstrumentedFolder({ remoteRoot, compileInto, compileId })}/${ressource}`

export const ressourceToLocalInstrumentedFile = ({
  ressource,
  localRoot,
  compileInto,
  compileId,
}) => `${getLocalInstrumentedFolder({ localRoot, compileInto, compileId })}/${ressource}`

export const ressourceToLocalCompiledFile = ({ ressource, localRoot, compileInto, compileId }) =>
  `${getLocalCompiledFolder({ localRoot, compileInto, compileId })}/${ressource}`

const getRemoteCompiledFolder = ({ remoteRoot, compileInto, compileId }) =>
  `${remoteRoot}/${compileInto}/${compileId}`

const getRemoteInstrumentedFolder = ({ remoteRoot, compileInto, compileId }) =>
  `${remoteRoot}/${compileInto}/${compileId}-instrumented`

const getLocalInstrumentedFolder = ({ localRoot, compileInto, compileId }) =>
  `${localRoot}/${compileInto}/${compileId}-instrumented`

const getLocalCompiledFolder = ({ localRoot, compileInto, compileId }) =>
  `${localRoot}/${compileInto}/${compileId}`

export const ressourceToRemoteSourceFile = ({ ressource, remoteRoot }) =>
  `${remoteRoot}/${ressource}`

export const ressourceToLocalSourceFile = ({ ressource, localRoot }) => `${localRoot}/${ressource}`

export const hrefToMeta = ({ href, remoteRoot, compileInto }) => {
  if (href === remoteRoot) return { type: "remote-root" }

  if (!href.startsWith(`${remoteRoot}/`)) return { type: "other", ressource: href }

  const remoteRessource = href.slice(`${remoteRoot}/`.length)
  if (!remoteRessource.startsWith(`${compileInto}/`)) {
    return {
      type: "remote-ressource",
      ressource: remoteRessource,
    }
  }

  const compiledRessource = remoteRessource.slice(`${compileInto}/`.length)
  const nextSlashIndex = compiledRessource.indexOf("/")
  if (nextSlashIndex === -1) {
    return {
      type: "remote-compile-folder",
      compileId: compiledRessource,
      ressource: "",
    }
  }

  const remoteRessourceCompileId = compiledRessource.slice(0, nextSlashIndex)
  const ressource = compiledRessource.slice(nextSlashIndex)

  return {
    type: "remote-compiled-ressource",
    compileId: remoteRessourceCompileId,
    ressource,
  }
}

export const remoteFileToRessource = ({ file, remoteRoot, compileInto, compileId }) =>
  hrefToMeta({ file, remoteRoot, compileInto, compileId }).ressource

export const remoteFileToLocalSourceFile = ({ file, localRoot, remoteRoot }) => {
  if (!localRoot) return file
  if (!file.startsWith(`${remoteRoot}/`)) return file
  const ressource = file.slice(`${remoteRoot}/`.length)
  return ressourceToLocalSourceFile({ ressource, localRoot })
}
