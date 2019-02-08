import { createCancellationToken } from "@dmail/cancellation"
import { resolveModuleSpecifier, resolveAPossibleNodeModuleFile } from "@jsenv/module-resolution"
import { parseRawDependencies } from "./parseRawDependencies.js"

// abstract/real pairs
// will be used to create a mapping for file that are not where
// we would expect them (because of node module)
// check systemjs import map, especially scopes
// https://github.com/systemjs/systemjs/blob/master/docs/import-maps.md#scopes

export const parseDependencies = async ({
  cancellationToken = createCancellationToken(),
  root,
  ressource,
  resolve = resolveModuleSpecifier,
  dynamicDependenciesCallback = (dynamicDependencies, ressource) => {
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
  const visitRessource = async (ressource) => {
    if (ressource in ressourceSeen) return
    ressourceSeen[ressource] = true

    const dependencies = await parseRessourceDependencies({
      cancellationToken,
      root,
      ressource,
      resolve,
      dynamicDependenciesCallback,
    })
    ressourceMap[ressource] = dependencies
    await Promise.all(dependencies.map(({ real }) => visitRessource(real)))
  }
  await visitRessource(ressource)
  return ressourceMap
}

const parseRessourceDependencies = async ({
  cancellationToken,
  root,
  ressource,
  resolve,
  dynamicDependenciesCallback,
}) => {
  const rawDependencies = await parseRawDependencies({ cancellationToken, root, ressource })

  const dynamicDependencies = rawDependencies.filter(
    ({ type }) =>
      type === "dynamic-specifier" ||
      type === "dynamic-file" ||
      type === "dynamic-specifier-and-dynamic-file",
  )
  if (dynamicDependencies.length) {
    dynamicDependenciesCallback(dynamicDependencies, ressource)
  }

  const staticDependencies = rawDependencies.filter(({ type }) => type === "static")

  const dependencies = staticDependencies.map(({ specifier, file }) => {
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

  return dependencies
}

const fileToRessource = ({ root, file }) => {
  return file.slice(root.length + 1)
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
