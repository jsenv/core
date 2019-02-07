import { resolveModuleSpecifier, resolveAPossibleNodeModuleFile } from "@jsenv/module-resolution"
import { parseRawDependencies } from "./parseRawDependencies.js"

export const parseDependencies = async ({
  root,
  ressource,
  resolve = resolveModuleSpecifier,
  dynamicDependenciesCallback = (dynamicDependencies, ressource) => {
    console.warn(`found ${dynamicDependencies.length} in ${ressource}`)
  },
}) => {
  const ressourceMap = {}
  const ressourceSeen = {}
  const visitRessource = async (ressource) => {
    if (ressource in ressourceSeen) return
    ressourceSeen[ressource] = true

    const dependencies = await parseRessourceDependencies({
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
  root,
  ressource,
  resolve,
  dynamicDependenciesCallback,
}) => {
  const rawDependencies = await parseRawDependencies({ root, ressource })

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
