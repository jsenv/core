export const ensureDependenciesInsideRoot = ({ root, dependencies }) => {
  Object.keys(dependencies).forEach((file) => {
    const dependency = dependencies[file]
    if (fileIsOutsideRoot({ file: dependency.file, root })) {
      throw createDependencyFileOutsideRootError({
        root,
        ressource: fileToRessource({ root, file }),
        dependencySpecifier: dependency.specifier,
        dependencyFile: dependency.file,
      })
    }
  })
}

const fileIsOutsideRoot = ({ root, file }) => {
  return !file.startsWith(`${root}`)
}

const createDependencyFileOutsideRootError = ({
  root,
  ressource,
  dependencySpecifier,
  dependencyFile,
}) => {
  return new Error(`unexpected dependency outside root.
root: ${root}
ressource: ${ressource}
dependencySpecifier: ${dependencySpecifier}
dependencyFile: ${dependencyFile}`)
}

const fileToRessource = ({ root, file }) => file.slice(root.length + 1)
