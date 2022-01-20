import { readDirectory, readFile, resolveUrl } from "@jsenv/filesystem"

import { featuresCompatFromRuntime } from "./features_compat_from_runtime.js"

export const createOutDirectory = async ({
  outDirectoryUrl,
  outDirectoryMetaFileName,
  featureNames,
}) => {
  const compileDirectories = await restoreCompileDirectoriesFromFileSystem({
    outDirectoryUrl,
    outDirectoryMetaFileName,
  })
  return {
    compileDirectories,
    getOrCreateCompileDirectoryId: ({ runtimeReport }) => {
      const runtimeName = runtimeReport.runtime.name
      const runtimeVersion = runtimeReport.runtime.version
      const { availableFeatureNames } = featuresCompatFromRuntime({
        runtimeName,
        runtimeVersion,
        featureNames,
      })
      const featuresReport = {}
      availableFeatureNames.forEach((availableFeatureName) => {
        featuresReport[availableFeatureName] = true
      })
      Object.assign(featuresReport, runtimeReport.featuresReport)
      const allFeaturesSupported = featureNames.every((featureName) =>
        Boolean(featuresReport[featureName]),
      )
      if (allFeaturesSupported) {
        return null
      }
      const existingCompileIds = Object.keys(compileDirectories)
      const existingCompileId = existingCompileIds.find(
        (compileIdCandidate) => {
          const compileDirectoryCandidate =
            compileDirectories[compileIdCandidate]
          return Object.keys(featuresReport).every(
            (featureName) =>
              featuresReport[featureName] ===
              compileDirectoryCandidate.featureReport[featureName],
          )
        },
      )
      if (existingCompileId) {
        return existingCompileId
      }
      const compileIdBase = generateCompileId({
        runtimeName,
        runtimeVersion,
        featureNames,
      })
      let compileId = compileIdBase
      let integer = 1
      while (existingCompileIds.includes(compileId)) {
        compileId = `${compileIdBase}${integer}`
        integer++
      }
      compileDirectories[compileId] = {
        featuresReport,
      }
      return compileId
    },
  }
}

const restoreCompileDirectoriesFromFileSystem = async ({
  logger,
  outDirectoryUrl,
  outDirectoryMetaFileName,
}) => {
  let existingDirectoryIds = []
  try {
    existingDirectoryIds = await readDirectory(outDirectoryUrl)
    const outDirectoryMetaFileIndex = existingDirectoryIds.indexOf(
      outDirectoryMetaFileName,
    )
    if (outDirectoryMetaFileIndex > -1) {
      existingDirectoryIds.splice(
        existingDirectoryIds.indexOf(outDirectoryMetaFileName),
        1,
      )
    }
  } catch (e) {
    if (e.code === "ENOENT") {
      return {}
    }
    throw e
  }
  const compileDirectories = {}
  await Promise.all(
    existingDirectoryIds.map(async (existingDirectoryId) => {
      const compileDirectoryMetaUrl = resolveUrl(
        `./${existingDirectoryId}/__compile_meta__.json`,
        outDirectoryUrl,
      )
      try {
        const compileDirectoryMeta = await readFile(compileDirectoryMetaUrl, {
          as: "json",
        })
        compileDirectories[existingDirectoryId] = compileDirectoryMeta
      } catch (e) {
        if (e && e.code === "ENOENT") {
          return
        }
        if (e && e.name === "SyntaxError") {
          logger.error(`Syntax error in ${compileDirectoryMetaUrl}`, e.stack)
          return
        }
        throw e
      }
    }),
  )
  return compileDirectories
}

const generateCompileId = ({ runtimeName, runtimeVersion, featureNames }) => {
  if (featureNames.includes("transform-instrument")) {
    return `${runtimeName}@${runtimeVersion}_cov`
  }
  return `${runtimeName}@${runtimeVersion}`
}
