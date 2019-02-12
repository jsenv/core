export const pathnameToCompiledHref = ({ pathname, compileInto, compileId, compiledRootHref }) =>
  `${getCompiledFolderHref({ compiledRootHref, compileInto, compileId })}/${pathname}`

export const pathnameToInstrumentedHref = ({
  pathname,
  compileInto,
  compiledRootHref,
  compileId,
}) => `${getInstrumentedFolderHref({ compiledRootHref, compileInto, compileId })}/${pathname}`

export const ressourceToLocalInstrumentedFile = ({
  ressource,
  localRoot,
  compileInto,
  compileId,
}) => `${getLocalInstrumentedFolder({ localRoot, compileInto, compileId })}/${ressource}`

export const ressourceToLocalCompiledFile = ({ ressource, localRoot, compileInto, compileId }) =>
  `${getLocalCompiledFolder({ localRoot, compileInto, compileId })}/${ressource}`

const getCompiledFolderHref = ({ compileInto, compileId, compiledRootHref }) =>
  `${compiledRootHref}/${compileInto}/${compileId}`

const getInstrumentedFolderHref = ({ compileInto, compiledRootHref, compileId }) =>
  `${compiledRootHref}/${compileInto}/${compileId}-instrumented`

const getLocalInstrumentedFolder = ({ localRoot, compileInto, compileId }) =>
  `${localRoot}/${compileInto}/${compileId}-instrumented`

const getLocalCompiledFolder = ({ localRoot, compileInto, compileId }) =>
  `${localRoot}/${compileInto}/${compileId}`

export const ressourceToRemoteSourceFile = ({ ressource, remoteRoot }) =>
  `${remoteRoot}/${ressource}`

export const pathnameToSourceHref = ({ pathname, rootHref }) => `${rootHref}/${pathname}`

export const hrefToMeta = (href, { remoteRoot, compileInto }) => {
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
  const ressource = compiledRessource.slice(nextSlashIndex + 1)

  return {
    type: "remote-compiled-ressource",
    compileId: remoteRessourceCompileId,
    ressource,
  }
}

export const hrefToPathname = (href, { compileInto, compiledRootHref, compileId }) =>
  hrefToMeta(href, { compileInto, compiledRootHref, compileId }).pathname

export const hrefToSourceHref = (href, { rootHref, compiledRootHref }) => {
  if (!rootHref) return href
  if (!href.startsWith(`${compiledRootHref}/`)) return href
  const pathname = href.slice(`${compiledRootHref}/`.length)
  return pathnameToSourceHref({ pathname, rootHref })
}
