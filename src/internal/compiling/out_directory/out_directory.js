import {
  resolveUrl,
  readFile,
  urlToRelativeUrl,
  writeFile,
  ensureEmptyDirectory,
} from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

import {
  TOOLBAR_INJECTOR_BUILD_URL,
  EVENT_SOURCE_CLIENT_BUILD_URL,
  BROWSER_RUNTIME_BUILD_URL,
} from "@jsenv/core/dist/build_manifest.js"
import {
  sourcemapMainFileInfo,
  sourcemapMappingFileInfo,
} from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

import { featuresCompatFromRuntime } from "./features_compat_from_runtime.js"

// Must list everything that can influence how the
// compiled files are generated. So that the filesystem cache for those generated
// files is not reused when it should not
// In some cases the parameters influences only a subset of files and ideally
// this parameter should somehow invalidate a subset of the cache
// To keep things simple these parameters currently invalidates the whole cache
export const setupOutDirectory = async ({
  logger,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryUrl,
  outDirectoryRelativeUrl,
  outDirectoryMetaFileUrl,

  importDefaultExtension,
  preservedUrls,
  workers,
  serviceWorkers,
  featureNames,
  babelPluginMap,
  replaceProcessEnvNodeEnv,
  processEnvNodeEnv,
  inlineImportMapIntoHTML,
  customCompilers,
  jsenvToolbarInjection,
  sourcemapMethod,
  sourcemapExcludeSources,

  compileServerCanWriteOnFilesystem,
}) => {
  const jsenvCorePackageFileUrl = resolveUrl(
    "./package.json",
    jsenvCoreDirectoryUrl,
  )
  const jsenvCorePackageVersion = await readFile(jsenvCorePackageFileUrl, {
    as: "json",
  }).version
  const customCompilerPatterns = Object.keys(customCompilers)
  const sourcemapMainFileRelativeUrl = urlToRelativeUrl(
    sourcemapMainFileInfo.url,
    projectDirectoryUrl,
  )
  const sourcemapMappingFileRelativeUrl = urlToRelativeUrl(
    sourcemapMappingFileInfo.url,
    projectDirectoryUrl,
  )
  const compileInfo = {
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,

    preservedUrls,
    workers,
    serviceWorkers,
    babelPluginMap: babelPluginMapAsData(babelPluginMap),
    featureNames,
    customCompilerPatterns,
    replaceProcessEnvNodeEnv,
    processEnvNodeEnv,
    inlineImportMapIntoHTML,

    sourcemapMethod,
    sourcemapExcludeSources,
    sourcemapMainFileRelativeUrl,
    sourcemapMappingFileRelativeUrl,
    errorStackRemapping: true,

    // used to consider logic generating files may have changed
    jsenvCorePackageVersion,

    // impact only HTML files
    jsenvToolbarInjection,
    TOOLBAR_INJECTOR_BUILD_URL,
    EVENT_SOURCE_CLIENT_BUILD_URL,
    BROWSER_RUNTIME_BUILD_URL,
  }
  const compileDirectories = {}
  const outDirectoryMeta = {
    compileInfo,
    compileDirectories,
  }
  if (compileServerCanWriteOnFilesystem) {
    await applyFileSystemEffects({
      logger,
      outDirectoryUrl,
      outDirectoryMetaFileUrl,
      outDirectoryMeta,
    })
  }

  const getOrCreateCompileDirectoryId = ({ runtimeReport }) => {
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
    const existingCompileId = existingCompileIds.find((compileIdCandidate) => {
      const compileDirectoryCandidate = compileDirectories[compileIdCandidate]
      return Object.keys(featuresReport).every(
        (featureName) =>
          featuresReport[featureName] ===
          compileDirectoryCandidate.featureReport[featureName],
      )
    })
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
  }

  return {
    compileDirectories,
    outDirectoryMeta,
    getOrCreateCompileDirectoryId,
  }
}

const applyFileSystemEffects = async ({
  logger,
  outDirectoryUrl,
  outDirectoryMetaFileUrl,
  outDirectoryMeta,
}) => {
  const outDirectoryMetaPrevious = await readFromFileSystem({
    logger,
    outDirectoryMetaFileUrl,
  })
  if (outDirectoryMetaPrevious && outDirectoryMetaPrevious) {
    const diff = diffCompileInfo(
      outDirectoryMetaPrevious.compileInfo,
      outDirectoryMeta.compileInfo,
    )
    if (diff) {
      logger.debug(
        createDetailedMessage(
          `Cleaning ${outDirectoryUrl} directory because compile server configuration has changed`,
          {
            changes: diff.namedChanges ? diff.namedChanges : `something`,
          },
        ),
      )
      await ensureEmptyDirectory(outDirectoryUrl)
    } else {
      outDirectoryMeta.compileDirectories =
        outDirectoryMetaPrevious.compileDirectories
    }
  }
  await writeFile(
    outDirectoryMetaFileUrl,
    JSON.stringify(outDirectoryMeta, null, "  "),
  )
  logger.debug(`-> ${outDirectoryMetaFileUrl}`)
}

const readFromFileSystem = async ({ logger, outDirectoryMetaFileUrl }) => {
  try {
    const source = await readFile(outDirectoryMetaFileUrl)
    if (source === "") {
      logger.debug(
        `out directory meta file is empty ${outDirectoryMetaFileUrl}`,
      )
      return null
    }
    const outDirectoryMetaOnFileSystem = JSON.parse(source)
    return outDirectoryMetaOnFileSystem
  } catch (e) {
    if (e.code === "ENOENT") {
      return null
    }
    if (e.name === "SyntaxError") {
      logger.warn(`Syntax error while parsing ${outDirectoryMetaFileUrl}`)
      return null
    }
    throw e
  }
}

const diffCompileInfo = (previousCompileInfo, compileInfo) => {
  const changes = []
  Object.keys(compileInfo).forEach((key) => {
    const now = compileInfo[key]
    const previous = previousCompileInfo[key]
    if (!compareValueJson(now, previous)) {
      changes.push(key)
    }
  })
  if (changes.length > 0) {
    return { namedChanges: changes }
  }
  // in case basic comparison from above is not enough
  if (!compareValueJson(previousCompileInfo, compileInfo)) {
    return { somethingChanged: true }
  }
  return null
}

const generateCompileId = ({ runtimeName, runtimeVersion, featureNames }) => {
  if (featureNames.includes("transform-instrument")) {
    return `${runtimeName}@${runtimeVersion}_cov`
  }
  return `${runtimeName}@${runtimeVersion}`
}

const babelPluginMapAsData = (babelPluginMap) => {
  const data = {}
  Object.keys(babelPluginMap).forEach((key) => {
    const value = babelPluginMap[key]
    if (Array.isArray(value)) {
      data[key] = value
      return
    }
    if (typeof value === "object") {
      data[key] = {
        options: value.options,
      }
      return
    }
    data[key] = value
  })
  return data
}

const compareValueJson = (left, right) => {
  return JSON.stringify(left) === JSON.stringify(right)
}
