import { createCancellationToken } from "@dmail/cancellation"
import { resolveModuleSpecifier, resolveAPossibleNodeModuleFile } from "@jsenv/module-resolution"
import { parseDependencies } from "./parseDependencies.js"

// abstract/real pairs
// will be used to create a mapping for file that are not where
// we would expect them (because of node module)
// check systemjs import map, especially scopes
// https://github.com/systemjs/systemjs/blob/master/docs/import-maps.md#scopes

/*
predictDependencies returns something like

{
  'main.js': [{
    abstract: 'dependency.js',
    real: 'dependency.js'
  }],
  'dependency.js': []
}
*/

export const predictDependencies = async ({
  cancellationToken = createCancellationToken(),
  root,
  ressource,
  resolve = resolveModuleSpecifier,
  unpredictableDependenciesCallback = (dynamicDependencies, ressource) => {
    // we warn and we don't throw because
    // user must know these won't be compiled
    // but this is not critical.
    // user know the logic behind the dynamic dependency
    // and can force compilation of underlying file when using compile
    console.warn(`found ${dynamicDependencies.length} in ${ressource}`)
  },
}) => {
  const ressourceMap = {}
  const ressourceSeen = {}
  const visitRessource = async (ressource, parent) => {
    if (ressource in ressourceSeen) return
    ressourceSeen[ressource] = true

    let dependencies

    try {
      dependencies = await predictRessourceDependencies({
        cancellationToken,
        root,
        ressource,
        resolve,
        unpredictableDependenciesCallback,
      })
    } catch (e) {
      if (e && e.code === "ENOENT") {
        if (parent) {
          throw createDependencyNotFoundError({
            root,
            ressource,
            dependency: parent,
          })
        }
        throw createRessourceNotFoundError({
          root,
          ressource,
        })
      }
      throw e
    }
    ressourceMap[ressource] = dependencies
    await Promise.all(dependencies.map(({ real }) => visitRessource(real, ressource)))
  }
  await visitRessource(ressource)
  return ressourceMap
}

const predictRessourceDependencies = async ({
  cancellationToken,
  root,
  ressource,
  resolve,
  unpredictableDependenciesCallback,
}) => {
  const dependencies = await parseDependencies({ cancellationToken, root, ressource })

  const unpredictableDependencies = dependencies.filter(
    ({ type }) =>
      type === "static-unpredictable" ||
      type === "dynamic-specifier" ||
      type === "dynamic-file" ||
      type === "dynamic-specifier-and-dynamic-file",
  )
  if (unpredictableDependencies.length) {
    unpredictableDependenciesCallback(unpredictableDependencies, ressource)
  }

  const predictableDependencies = dependencies.filter(({ type }) => type === "static")

  return predictableDependencies.map(({ specifier, file }) => {
    const dependencyFile = resolve({
      root,
      moduleSpecifier: specifier,
      file,
    })
    if (fileIsOutsideRoot({ file: dependencyFile, root })) {
      throw createDependencyFileOutsideRootError({
        root,
        ressource,
        specifier,
        dependencyFile,
      })
    }

    const nodeModuleFile = resolveAPossibleNodeModuleFile(dependencyFile)
    if (nodeModuleFile && nodeModuleFile !== dependencyFile) {
      if (fileIsOutsideRoot({ file: nodeModuleFile, root })) {
        throw createDependencyFileOutsideRootError({
          root,
          ressource,
          specifier,
          dependencyFile: nodeModuleFile,
        })
      }

      const abstract = fileToRessource({ root, file: dependencyFile })
      const real = fileToRessource({ root, file: nodeModuleFile })
      if (real === ressource) {
        throw createSelfDependencyError({
          root,
          ressource,
          specifier,
        })
      }

      return {
        abstract,
        real,
      }
    }

    const abstract = fileToRessource({ root, file: dependencyFile })
    const real = fileToRessource({ root, file: nodeModuleFile })
    if (real === ressource) {
      throw createSelfDependencyError({
        root,
        ressource,
        specifier,
      })
    }
    return {
      abstract,
      real,
    }
  })
}

const fileToRessource = ({ root, file }) => {
  return file.slice(root.length + 1)
}

const createRessourceNotFoundError = ({ root, ressource }) => {
  return new Error(`ressource not found.
root: ${root}
ressource: ${ressource}`)
}

const createDependencyNotFoundError = ({ root, ressource, dependency }) => {
  return new Error(`dependency not found.
root: ${root}
ressource: ${ressource}
dependency: ${dependency}`)
}

const createSelfDependencyError = ({ root, ressource, specifier }) => {
  return new Error(`unexpected self dependency.
root: ${root}
ressource: ${ressource}
specifier: ${specifier}`)
}

const createDependencyFileOutsideRootError = ({ root, ressource, specifier, dependencyFile }) => {
  return new Error(`unexpected dependency outside root.
root: ${root}
ressource: ${ressource}
specifier: ${specifier}
dependencyFile: ${dependencyFile}`)
}

const fileIsOutsideRoot = ({ root, file }) => {
  return !file.startsWith(`${root}`)
}
