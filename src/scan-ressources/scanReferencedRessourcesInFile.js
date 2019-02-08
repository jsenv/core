import { createCancellationToken } from "@dmail/cancellation"
import { parseFileDependencies } from "./parseFileDependencies.js"

/*
collectReferencesMapping returns something like

{
  '/Users/dmail/folder/main.js': {
    unpredictable: [],
    remotePredictable: [],
    localPredictable: [
      {
        specifier: './dependency.js',
        specifierFile: '/Users/dmail/folder/main.js',
        file: '/Users/dmail/folder/dependency.js',
        realFile: '/Users/dmail/folder/dependency.js',
      },
    ],
  },
  '/Users/dmail/folder/dependency.js': {
    unpredictable: [],
    remotePredictable: [],
    localPredictable: []
  }
}
*/

export const scanReferencedRessourcesInFile = async ({
  cancellationToken = createCancellationToken(),
  file,
  resolve,
  resolveReal,
}) => {
  const referencedRessources = {}

  const seenMap = {}
  const scanFile = async (file, { referencedByFile, referencedBySpecifier } = {}) => {
    if (file in seenMap) return
    seenMap[file] = true

    let categorizedRessources
    try {
      categorizedRessources = await shallowScanReferencedRessourcesInFile({
        cancellationToken,
        file,
        resolve,
        resolveReal,
      })
    } catch (e) {
      if (e && e.code === "ENOENT") {
        if (referencedByFile) {
          throw createReferencedFileNotFoundError({
            file,
            referencedByFile,
            referencedBySpecifier,
          })
        }
        throw createFileNotFoundError({
          file,
        })
      }
      throw e
    }
    referencedRessources[file] = categorizedRessources
    await Promise.all(
      categorizedRessources.localPredictable.map((dependency) =>
        scanFile(dependency.realFile, {
          referencedByFile: file,
          referencedBySpecifier: dependency.specifier,
        }),
      ),
    )
  }
  await scanFile(file)

  return referencedRessources
}

const shallowScanReferencedRessourcesInFile = async ({
  cancellationToken,
  file,
  resolve,
  resolveReal,
}) => {
  const dependencies = await parseFileDependencies({ cancellationToken, file })

  const unpredictable = []
  const remotePredictable = []
  const localPredictable = []

  dependencies.forEach(({ type, specifier, specifierFile }) => {
    if (type !== "static") {
      unpredictable.push({
        specifier,
        specifierFile,
      })
      return
    }

    const dependencyFile = resolve({ specifier, specifierFile })
    if (fileIsRemote(dependencyFile)) {
      remotePredictable.push({
        specifier,
        specifierFile,
        file: dependencyFile,
        realFile: dependencyFile,
      })
      return
    }

    const dependencyRealFile = resolveReal(dependencyFile)
    if (dependencyRealFile === file) {
      throw createSelfReferenceError({
        file,
        specifier,
      })
    }

    localPredictable.push({
      specifier,
      specifierFile,
      file: dependencyFile,
      realFile: dependencyRealFile,
    })
  })

  return {
    unpredictable,
    localPredictable,
    remotePredictable,
  }
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

const createReferencedFileNotFoundError = ({ file, referencedByFile, referencedBySpecifier }) => {
  return new Error(`referenced file not found.
file: ${file}
referencedByFile: ${referencedByFile}
referencedBySpecifier: ${referencedBySpecifier}`)
}

const createSelfReferenceError = ({ file, specifier }) => {
  return new Error(`unexpected self reference.
file: ${file}
specifier: ${specifier}`)
}
