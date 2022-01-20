import {
  resolveUrl,
  readFile,
  urlToRelativeUrl,
  writeFile,
} from "@jsenv/filesystem"

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

// Must list everything that can influence how the
// compiled files are generated. So that the filesystem cache for those generated
// files is not reused when it should not
// In some cases the parameters influences only a subset of files and ideally
// this parameter should somehow invalidate a subset of the cache
// To keep things simple these parameters currently invalidates the whole cache
export const createOutDirectoryMeta = async ({
  logger,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
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
  const outDirectoryMeta = {
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

  return {
    readFromFileSystem: async () => {
      try {
        const source = await readFile(outDirectoryMetaFileUrl)
        if (source === "") {
          logger.debug(
            `compiler server meta file is empty ${outDirectoryMetaFileUrl}`,
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
    },

    writeOnFileSystem: async () => {
      await writeFile(
        outDirectoryMetaFileUrl,
        JSON.stringify(outDirectoryMeta, null, "  "),
      )
    },

    compare: (previousOutDirectoryMeta) => {
      const changes = []
      Object.keys(outDirectoryMeta).forEach((key) => {
        const now = outDirectoryMeta[key]
        const previous = previousOutDirectoryMeta[key]
        if (!compareValueJson(now, previous)) {
          changes.push(key)
        }
      })
      if (changes.length > 0) {
        return { namedChanges: changes }
      }
      // in case basic comparison from above is not enough
      if (!compareValueJson(previousOutDirectoryMeta, outDirectoryMeta)) {
        return { somethingChanged: true }
      }
      return null
    },

    toJSON: () => outDirectoryMeta,
  }
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
