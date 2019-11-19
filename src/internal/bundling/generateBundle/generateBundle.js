/* eslint-disable import/max-dependencies */
import {
  catchAsyncFunctionCancellation,
  createCancellationTokenForProcessSIGINT,
} from "@jsenv/cancellation"
import { createLogger } from "@jsenv/logger"
import {
  pathToDirectoryUrl,
  resolveFileUrl,
  resolveDirectoryUrl,
  fileUrlToPath,
  urlToRelativeUrl,
} from "internal/urlUtils.js"
import { assertFileExists, removeDirectory } from "internal/filesystemUtils.js"
import {
  assertProjectDirectoryPath,
  assertProjectDirectoryExists,
  assertImportMapFileRelativeUrl,
  assertImportMapFileInsideProject,
} from "internal/argUtils.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { jsenvBabelPluginMap } from "src/jsenvBabelPluginMap.js"
import { jsenvBrowserScoreMap } from "src/jsenvBrowserScoreMap.js"
import { jsenvNodeVersionScoreMap } from "src/jsenvNodeVersionScoreMap.js"
import { generateBabelPluginMapForBundle } from "../generateBabelPluginMapForBundle.js"
import { bundleEntryPoints } from "./bundleEntryPoints.js"
import { isBareSpecifierForNativeNodeModule } from "./isBareSpecifierForNativeNodeModule.js"

export const generateBundle = async ({
  cancellationToken = createCancellationTokenForProcessSIGINT(),
  logLevel = "info",
  compileServerLogLevel = "warn",
  logger,

  // "classic" params
  projectDirectoryPath,
  importMapFileRelativeUrl = "./importMap.json",
  importDefaultExtension,
  env = {},
  browser = false,
  node = false,

  // compiling related params
  babelPluginMap = jsenvBabelPluginMap,
  compileGroupCount = 1,
  platformScoreMap = {
    ...jsenvBrowserScoreMap,
    node: jsenvNodeVersionScoreMap,
  },
  balancerTemplateFileUrl,
  balancerDataAbstractSpecifier,

  // bundle related params
  entryPointMap = {
    main: "./index.js",
  },
  bundleDirectoryRelativeUrl,
  bundleDirectoryClean = false,
  format,
  formatOutputOptions = {},
  minify = false,
  writeOnFileSystem = true,
  sourcemapExcludeSources = false,

  ...rest
}) => {
  logger = logger || createLogger({ logLevel })

  assertProjectDirectoryPath({ projectDirectoryPath })
  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
  await assertProjectDirectoryExists({ projectDirectoryUrl })

  assertImportMapFileRelativeUrl({ importMapFileRelativeUrl })
  const importMapFileUrl = resolveFileUrl(importMapFileRelativeUrl, projectDirectoryUrl)
  assertImportMapFileInsideProject({ importMapFileUrl, projectDirectoryUrl })

  assertEntryPointMap({ entryPointMap })

  assertBundleDirectoryRelativeUrl({ bundleDirectoryRelativeUrl })
  const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativeUrl, projectDirectoryUrl)
  assertBundleDirectoryInsideProject({ bundleDirectoryUrl, projectDirectoryUrl })
  if (bundleDirectoryClean) {
    await removeDirectory(fileUrlToPath(bundleDirectoryUrl))
  }

  const compileDirectoryUrl = `${bundleDirectoryUrl}.dist/`
  const chunkId = `${Object.keys(entryPointMap)[0]}.js`
  env = {
    ...env,
    chunkId,
  }
  babelPluginMap = {
    ...babelPluginMap,
    ...generateBabelPluginMapForBundle({ format }),
  }

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

    const compileServer = await startCompileServer({
      cancellationToken,
      compileServerLogLevel,

      projectDirectoryUrl,
      importMapFileUrl,
      importDefaultExtension,
      env,

      babelPluginMap,
      platformScoreMap,
      compileDirectoryUrl,
      writeOnFilesystem: true,
      useFilesystemAsCache: true,

      // override with potential custom options
      ...rest,

      transformModuleIntoSystemFormat: false, // will be done by rollup
    })

    // ne pas oublier de retourner un truc permettant de savoir
    // quelle url sont abstract (importReplaceMap)
    // pour que bundleToCompilationResult fonction correctement

    const compileDirectoryServerUrl = `${compileServer.origin}/${urlToRelativeUrl(
      compileDirectoryUrl,
      projectDirectoryUrl,
    )}`

    if (compileGroupCount === 1) {
      return bundleEntryPoints({
        cancellationToken,
        logger,

        projectDirectoryUrl,
        entryPointMap,
        bundleDirectoryUrl,
        importDefaultExtension,
        nativeModulePredicate,

        compileServer,
        compileDirectoryServerUrl: `${compileDirectoryServerUrl}otherwise/`,

        babelPluginMap,

        minify,
        format,
        formatOutputOptions,
        writeOnFileSystem,
        sourcemapExcludeSources,
      })
    }

    return await Promise.all([
      generateEntryPointsDirectories({
        cancellationToken,
        logger,

        projectDirectoryUrl,
        entryPointMap,
        bundleDirectoryUrl,
        importDefaultExtension,
        nativeModulePredicate,

        compileServer,
        compileDirectoryServerUrl,

        format,
        formatOutputOptions,
        minify,
        writeOnFileSystem,
        sourcemapExcludeSources,
      }),
      generateEntryPointsBalancerFiles({
        cancellationToken,
        logger,

        projectDirectoryUrl,
        entryPointMap,
        bundleDirectoryUrl,
        importDefaultExtension,
        nativeModulePredicate,
        balancerTemplateFileUrl,
        balancerDataAbstractSpecifier,

        compileServer,
        compileDirectoryServerUrl,

        format,
        minify,
        writeOnFileSystem,
        sourcemapExcludeSources,
      }),
    ])
  })
}

const assertEntryPointMap = ({ entryPointMap }) => {
  if (typeof entryPointMap !== "object") {
    throw new TypeError(`entryPointMap must be an object, got ${entryPointMap}`)
  }
  Object.keys(entryPointMap).forEach((entryName) => {
    const entryRelativeUrl = entryPointMap[entryName]
    if (typeof entryRelativeUrl !== "string") {
      throw new TypeError(
        `found unexpected value in entryPointMap, it must be a string but found ${entryRelativeUrl} for key ${entryName}`,
      )
    }
    if (!entryRelativeUrl.startsWith("./")) {
      throw new TypeError(
        `found unexpected value in entryPointMap, it must start with ./ but found ${entryRelativeUrl} for key ${entryName}`,
      )
    }
  })
}

const assertBundleDirectoryRelativeUrl = ({ bundleDirectoryRelativeUrl }) => {
  if (typeof bundleDirectoryRelativeUrl !== "string") {
    throw new TypeError(
      `bundleDirectoryRelativeUrl must be a string, received ${bundleDirectoryRelativeUrl}`,
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

const generateEntryPointsDirectories = async ({
  compileServer,
  bundleDirectoryUrl,
  compileDirectoryServerUrl,
  ...rest
}) =>
  Promise.all(
    Object.keys(compileServer.groupMap).map(async (compileId) =>
      bundleEntryPoints({
        compileServer,
        bundleDirectoryUrl: resolveDirectoryUrl(compileId, bundleDirectoryUrl),
        compileDirectoryServerUrl: resolveDirectoryUrl(compileId, compileDirectoryServerUrl),
        ...rest,
      }),
    ),
  )

const generateEntryPointsBalancerFiles = ({
  projectDirectoryUrl,
  bundleDirectoryUrl,
  compileDirectoryServerUrl,
  entryPointMap,
  balancerTemplateFileUrl,
  ...rest
}) =>
  Promise.all(
    Object.keys(entryPointMap).map(async (entryPointName) =>
      bundleEntryPoints({
        projectDirectoryUrl,
        bundleDirectoryUrl: resolveDirectoryUrl("otherwise", bundleDirectoryUrl),
        compileDirectoryServerUrl: resolveDirectoryUrl("otherwise", compileDirectoryServerUrl),
        entryPointMap: {
          [entryPointName]: urlToRelativeUrl(balancerTemplateFileUrl, projectDirectoryUrl),
        },
        format: "global",
        sourcemapExcludeSources: true,
        ...rest,
      }),
    ),
  )
