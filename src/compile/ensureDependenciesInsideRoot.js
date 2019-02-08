export const ensureDependenciesInsideRoot = ({ root, ressource, dependencies }) => {
  dependencies.forEach(({ specifier, file }) => {
    if (fileIsOutsideRoot({ file, root })) {
      throw createDependencyFileOutsideRootError({
        root,
        ressource,
        specifier,
        dependencyFile: file,
      })
    }
  })
}

const fileIsOutsideRoot = ({ root, file }) => {
  return !file.startsWith(`${root}`)
}

const createDependencyFileOutsideRootError = ({ root, ressource, specifier, dependencyFile }) => {
  return new Error(`unexpected dependency outside root.
root: ${root}
ressource: ${ressource}
specifier: ${specifier}
dependencyFile: ${dependencyFile}`)
}
