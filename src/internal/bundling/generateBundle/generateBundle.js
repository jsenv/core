/* eslint-disable import/max-dependencies */
import {
  catchAsyncFunctionCancellation,
  createCancellationTokenForProcessSIGINT,
} from "@jsenv/cancellation"
import {
  pathToDirectoryUrl,
  resolveDirectoryUrl,
  resolveFileUrl,
  fileUrlToPath,
} from "internal/urlUtils.js"
import { assertFileExists, removeDirectory } from "internal/filesystemUtils.js"
import {
  assertProjectDirectoryPath,
  assertProjectDirectoryExists,
  assertImportMapFileRelativePath,
  assertImportMapFileInsideProject,
} from "internal/argUtils.js"
import { generateGroupMap } from "internal/generateGroupMap/generateGroupMap.js"
import { jsenvBabelPluginMap } from "src/jsenvBabelPluginMap.js"
import { jsenvBrowserScoreMap } from "src/jsenvBrowserScoreMap.js"
import { jsenvNodeVersionScoreMap } from "src/jsenvNodeVersionScoreMap.js"
import { bundleWithoutBalancing } from "./bundleWithoutBalancing.js"
import { bundleWithBalancing } from "./bundleWithBalancing.js"
import { bundleBalancer } from "./bundleBalancer.js"
import { isBareSpecifierForNativeNodeModule } from "./isBareSpecifierForNativeNodeModule.js"

export const generateBundle = async ({
  cancellationToken = createCancellationTokenForProcessSIGINT(),
  projectDirectoryPath,
  bundleDirectoryRelativePath,
  bundleDirectoryClean = false,
  bundleCache = false,
  importMapFileRelativePath = "./importMap.json",
  importMapForBundle = {},
  importDefaultExtension,
  importReplaceMap = {},
  importFallbackMap = {},
  browser = false,
  node = false,
  entryPointMap = {
    main: "./index.js",
  },
  sourcemapPreferLeadingSlash,
  babelPluginMap = jsenvBabelPluginMap,
  convertMap,
  logLevel = "info",
  minify = false,
  writeOnFileSystem = true,
  format,
  formatOutputOptions = {},
  // balancing
  compileGroupCount = 1,
  platformAlwaysInsidePlatformScoreMap,
  platformWillAlwaysBeKnown,
  balancerTemplateFileUrl,
  balancerDataAbstractSpecifier,
  platformScoreMap = {
    ...jsenvBrowserScoreMap,
    node: jsenvNodeVersionScoreMap,
  },
}) => {
  assertProjectDirectoryPath({ projectDirectoryPath })
  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
  await assertProjectDirectoryExists({ projectDirectoryUrl })

  assertBundleDirectoryRelativePath({ bundleDirectoryRelativePath })
  const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativePath, projectDirectoryUrl)
  assertBundleDirectoryInsideProject({ bundleDirectoryUrl, projectDirectoryUrl })
  if (bundleDirectoryClean) {
    await removeDirectory(fileUrlToPath(bundleDirectoryUrl))
  }

  assertImportMapFileRelativePath({ importMapFileRelativePath })
  const importMapFileUrl = resolveFileUrl(importMapFileRelativePath, projectDirectoryUrl)
  assertImportMapFileInsideProject({ importMapFileUrl, projectDirectoryUrl })

  assertEntryPointMap({ entryPointMap })
  assertCompileGroupCount({ compileGroupCount })
  if (compileGroupCount > 1) {
    if (typeof balancerTemplateFileUrl === "undefined") {
      throw new Error(`${format} format not compatible with balancing.`)
    }
    await assertFileExists(balancerTemplateFileUrl)
  }

  return catchAsyncFunctionCancellation(async () => {
    const nativeModulePredicate = (specifier) => {
      if (node && isBareSpecifierForNativeNodeModule(specifier)) return true
      // for now browser have no native module
      // and we don't know how we will handle that
      if (browser) return false
      return false
    }

    if (compileGroupCount === 1) {
      return bundleWithoutBalancing({
        cancellationToken,
        projectDirectoryUrl,
        bundleDirectoryUrl,
        bundleCache,
        importMapFileUrl,
        importMapForBundle,
        importDefaultExtension,
        importReplaceMap,
        importFallbackMap,
        nativeModulePredicate,
        entryPointMap,
        sourcemapPreferLeadingSlash,
        babelPluginMap,
        convertMap,
        minify,
        logLevel,
        format,
        formatOutputOptions,
        writeOnFileSystem,
      })
    }

    const groupMap = generateGroupMap({
      babelPluginMap,
      platformScoreMap,
      groupCount: compileGroupCount,
      platformAlwaysInsidePlatformScoreMap,
      platformWillAlwaysBeKnown,
    })

    return await Promise.all([
      generateEntryPointsFolders({
        cancellationToken,
        projectDirectoryUrl,
        bundleDirectoryUrl,
        bundleCache,
        importMapFileUrl,
        importMapFileRelativePath,
        importMapForBundle,
        importDefaultExtension,
        importReplaceMap,
        importFallbackMap,
        nativeModulePredicate,
        entryPointMap,
        sourcemapPreferLeadingSlash,
        babelPluginMap,
        convertMap,
        minify,
        logLevel,
        writeOnFileSystem,
        format,
        formatOutputOptions,
        groupMap,
      }),
      generateEntryPointsBalancerFiles({
        cancellationToken,
        projectDirectoryUrl,
        bundleDirectoryUrl,
        bundleCache,
        importMapFileUrl,
        importMapForBundle,
        importDefaultExtension,
        importReplaceMap,
        importFallbackMap,
        nativeModulePredicate,
        entryPointMap,
        sourcemapPreferLeadingSlash,
        babelPluginMap,
        convertMap,
        minify,
        logLevel,
        writeOnFileSystem,
        format,
        balancerTemplateFileUrl,
        balancerDataAbstractSpecifier,
        groupMap,
      }),
    ])
  })
}

const assertEntryPointMap = ({ entryPointMap }) => {
  if (typeof entryPointMap !== "object") {
    throw new TypeError(`entryPointMap must be an object, got ${entryPointMap}`)
  }
  Object.keys(entryPointMap).forEach((entryName) => {
    const entryRelativePath = entryPointMap[entryName]
    if (typeof entryRelativePath !== "string") {
      throw new TypeError(
        `found unexpected value in entryPointMap, it must be a string but found ${entryRelativePath} for key ${entryName}`,
      )
    }
    if (!entryRelativePath.startsWith("./")) {
      throw new TypeError(
        `found unexpected value in entryPointMap, it must start with ./ but found ${entryRelativePath} for key ${entryName}`,
      )
    }
  })
}

const assertBundleDirectoryRelativePath = ({ bundleDirectoryRelativePath }) => {
  if (typeof bundleDirectoryRelativePath !== "string") {
    throw new TypeError(
      `bundleDirectoryRelativePath must be a string, received ${bundleDirectoryRelativePath}`,
    )
  }
}

const assertBundleDirectoryInsideProject = ({ bundleDirectoryUrl, projectDirectoryUrl }) => {
  if (!bundleDirectoryUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`bundle directory must be inside project directory
--- bundle directory url ---
${bundleDirectoryUrl}
--- project directory url ---
${projectDirectoryUrl}`)
  }
}

const assertCompileGroupCount = ({ compileGroupCount }) => {
  if (typeof compileGroupCount !== "number") {
    throw new TypeError(`compileGroupCount must be a number, got ${compileGroupCount}`)
  }
  if (compileGroupCount < 1) {
    throw new Error(`compileGroupCount must be >= 1, got ${compileGroupCount}`)
  }
}

const generateEntryPointsFolders = async ({ groupMap, ...rest }) =>
  Promise.all(
    Object.keys(groupMap).map(async (compileId) =>
      bundleWithBalancing({
        groupMap,
        compileId,
        ...rest,
      }),
    ),
  )

const generateEntryPointsBalancerFiles = ({ entryPointMap, balancerTemplateFileUrl, ...rest }) =>
  Promise.all(
    Object.keys(entryPointMap).map(async (entryPointName) =>
      bundleBalancer({
        entryPointMap: {
          [entryPointName]: fileUrlToPath(balancerTemplateFileUrl),
        },
        ...rest,
      }),
    ),
  )
