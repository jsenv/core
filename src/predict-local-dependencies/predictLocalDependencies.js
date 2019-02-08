import { createCancellationToken } from "@dmail/cancellation"
import { parseDependencies } from "./parseDependencies.js"

/*
predictLocalDependencies returns something like

{
  '/Users/dmail/folder/main.js': [{
    specifier: './dependency.js',
    specifierFile: '/Users/dmail/folder/main.js',
    file: '/Users/dmail/folder/dependency.js'
  }],
  '/Users/dmail/folder/dependency.js': []
}
*/

export const predictLocalDependencies = async ({
  cancellationToken = createCancellationToken(),
  file,
  resolve,
  resolveReal,
  unpredictableDependenciesCallback = (dynamicDependencies, file) => {
    // we warn and we don't throw because
    // user must know these won't be compiled
    // but this is not critical.
    // user know the logic behind the dynamic dependency
    // and can force compilation of underlying file when using compile
    console.warn(`found ${dynamicDependencies.length} in ${file}`)
  },
}) => {
  const dependenciesMap = {}

  const seenMap = {}
  const visitFile = async (file, { parentFile, parentSpecifier } = {}) => {
    if (file in seenMap) return
    seenMap[file] = true

    let dependencies

    try {
      dependencies = await predictRessourceDependencies({
        cancellationToken,
        file,
        resolve,
        resolveReal,
        unpredictableDependenciesCallback: (unpredictableDependencies) =>
          unpredictableDependenciesCallback(unpredictableDependencies, file),
      })
    } catch (e) {
      if (e && e.code === "ENOENT") {
        if (parentFile) {
          throw createDependencyFileNotFoundError({
            file,
            specifier: parentSpecifier,
            dependencyFile: parentFile,
          })
        }
        throw createFileNotFoundError({
          file,
        })
      }
      throw e
    }
    dependenciesMap[file] = dependencies
    await Promise.all(
      dependencies.map((dependency) =>
        visitFile(dependency.file, { parentSpecifier: dependency.specifier, parentFile: file }),
      ),
    )
  }
  await visitFile(file)

  return dependenciesMap
}

const predictRessourceDependencies = async ({
  cancellationToken,
  file,
  resolve,
  resolveReal,
  unpredictableDependenciesCallback,
}) => {
  const dependencies = await parseDependencies({ cancellationToken, file })

  const unpredictableDependencies = dependencies.filter(
    ({ type }) =>
      type === "static-unpredictable" ||
      type === "dynamic-specifier" ||
      type === "dynamic-file" ||
      type === "dynamic-specifier-and-dynamic-file",
  )
  if (unpredictableDependencies.length) {
    unpredictableDependenciesCallback(unpredictableDependencies)
  }

  const predictableDependencies = dependencies.filter(({ type }) => type === "static")

  const localPredictableDependencies = []

  const foundLocalPredictableDependencyFile = (
    { specifier, specifierFile },
    dependencyFile,
    dependencyAbstractFile,
  ) => {
    if (dependencyFile === file) {
      throw createSelfDependencyError({
        file,
        specifier,
      })
    }
    localPredictableDependencies.push({
      specifier,
      specifierFile,
      file: dependencyFile,
      abstractFile: dependencyAbstractFile,
    })
  }

  predictableDependencies.forEach((dependency) => {
    const dependencyAbstractFile = resolve(dependency)

    if (fileIsRemote(dependencyAbstractFile)) return

    const dependencyFile = resolveReal(dependencyAbstractFile)
    foundLocalPredictableDependencyFile(dependency, dependencyFile, dependencyAbstractFile)
  })

  return localPredictableDependencies
}

const fileIsRemote = (file) => {
  if (file.startsWith("http://")) return true
  if (file.startsWith("https://")) return true
  return false
}

const createFileNotFoundError = ({ file }) => {
  return new Error(`file not found.
file: ${file}`)
}

const createDependencyFileNotFoundError = ({ file, specifier, dependencyFile }) => {
  return new Error(`dependency not found.
file: ${file}
specifier: ${specifier}
dependencyFile: ${dependencyFile}`)
}

const createSelfDependencyError = ({ file, specifier }) => {
  return new Error(`unexpected self dependency.
file: ${file}
specifier: ${specifier}`)
}
