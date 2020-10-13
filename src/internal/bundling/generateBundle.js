/* eslint-disable import/max-dependencies */
import { extname } from "path"
import { createLogger } from "@jsenv/logger"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  assertFilePresence,
  ensureEmptyDirectory,
  createCancellationTokenForProcess,
} from "@jsenv/util"
import { wrapExternalFunctionExecution } from "../wrapExternalFunctionExecution.js"
import { COMPILE_ID_OTHERWISE } from "../CONSTANTS.js"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "../argUtils.js"
import { startCompileServer } from "../compiling/startCompileServer.js"
import { jsenvBabelPluginMap } from "../../jsenvBabelPluginMap.js"
import { jsenvBrowserScoreMap } from "../../jsenvBrowserScoreMap.js"
import { jsenvNodeVersionScoreMap } from "../../jsenvNodeVersionScoreMap.js"
import { createBabePluginMapForBundle } from "./createBabePluginMapForBundle.js"
import { generateBundleUsingRollup } from "./generateBundleUsingRollup.js"

export const generateBundle = async ({
  cancellationToken = createCancellationTokenForProcess(),
  logLevel = "info",
  compileServerLogLevel = "warn",
  logger,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  externalImportSpecifiers = [],
  env = {},
  browser = false,
  node = false,

  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap = jsenvBabelPluginMap,
  compileGroupCount = 1,
  runtimeScoreMap = {
    ...jsenvBrowserScoreMap,
    node: jsenvNodeVersionScoreMap,
  },
  systemJsScript,
  balancerTemplateFileUrl,

  entryPointMap = {
    main: "./index.js",
  },
  bundleDirectoryRelativeUrl,
  bundleDirectoryClean = false,
  bundleDefaultExtension = ".js",
  format,
  formatInputOptions = {},
  formatOutputOptions = {},
  minify = process.env.NODE_ENV === "production",
  minifyJsOptions = {},
  minifyCssOptions = {},
  minifyHtmlOptions = {
    collapseWhitespace: true,
  },
  sourcemapExcludeSources = false,
  writeOnFileSystem = true,
  manifestFile = false,

  // when true .jsenv/out-bundle directory is generated
  // with all intermediated files used to produce the final bundle.
  // it might improve generateBundle speed for subsequent bundle generation
  // but this is to be proven and not absolutely required
  // When false intermediates files are transformed and served in memory
  // by the compile server
  // must be true by default otherwise rollup cannot find sourcemap files
  // when asking them to the compile server
  // (to fix that sourcemap could be inlined)
  filesystemCache = true,

  ...rest
}) => {
  return wrapExternalFunctionExecution(async () => {
    logger = logger || createLogger({ logLevel })

    projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
    await assertProjectDirectoryExists({ projectDirectoryUrl })

    assertEntryPointMap({ entryPointMap })

    if (Object.keys(entryPointMap).length === 0) {
      logger.error(`entryPointMap is an empty object`)
      return { rollupBundle: {} }
    }

    assertBundleDirectoryRelativeUrl({ bundleDirectoryRelativeUrl })
    const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativeUrl, projectDirectoryUrl)
    assertBundleDirectoryInsideProject({ bundleDirectoryUrl, projectDirectoryUrl })
    if (bundleDirectoryClean) {
      await ensureEmptyDirectory(bundleDirectoryUrl)
    }

    let chunkId = Object.keys(entryPointMap)[0]
    if (!extname(chunkId)) chunkId += bundleDefaultExtension
    env = {
      ...env,
      chunkId,
    }
    babelPluginMap = {
      ...babelPluginMap,
      ...createBabePluginMapForBundle({
        format,
      }),
    }

    assertCompileGroupCount({ compileGroupCount })
    if (compileGroupCount > 1) {
      if (typeof balancerTemplateFileUrl === "undefined") {
        throw new Error(`${format} format not compatible with balancing.`)
      }
      await assertFilePresence(balancerTemplateFileUrl)
    }

    const compileServer = await startCompileServer({
      cancellationToken,
      compileServerLogLevel,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      outDirectoryName: "out-bundle",
      importMapFileRelativeUrl,
      importDefaultExtension,

      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      env,
      babelPluginMap,
      compileGroupCount,
      runtimeScoreMap,
      writeOnFilesystem: filesystemCache,
      useFilesystemAsCache: filesystemCache,

      // override with potential custom options
      ...rest,

      transformModuleIntoSystemFormat: false, // will be done by rollup
    })

    const {
      outDirectoryRelativeUrl,
      origin: compileServerOrigin,
      compileServerGroupMap,
    } = compileServer

    if (compileGroupCount === 1) {
      return generateBundleUsingRollup({
        cancellationToken,
        logger,

        projectDirectoryUrl,
        entryPointMap,
        bundleDirectoryUrl,
        bundleDefaultExtension,
        importMapFileRelativeUrl: compileServer.importMapFileRelativeUrl,
        compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/`,
        compileServerOrigin,
        importDefaultExtension,
        externalImportSpecifiers,

        babelPluginMap,
        node,
        browser,
        minify,
        minifyJsOptions,
        minifyCssOptions,
        minifyHtmlOptions,
        format,
        formatInputOptions,
        formatOutputOptions,
        writeOnFileSystem,
        sourcemapExcludeSources,
        manifestFile,
        systemJsScript,
      })
    }

    return await Promise.all([
      generateEntryPointsDirectories({
        cancellationToken,
        logger,

        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        bundleDirectoryUrl,
        bundleDefaultExtension,
        importMapFileRelativeUrl: compileServer.importMapFileRelativeUrl,
        entryPointMap,
        compileServerOrigin,
        importDefaultExtension,
        externalImportSpecifiers,

        babelPluginMap,
        compileServerGroupMap,
        node,
        browser,
        format,
        formatInputOptions,
        formatOutputOptions,
        minify,
        writeOnFileSystem,
        sourcemapExcludeSources,
        manifestFile,
        systemJsScript,
      }),
      generateEntryPointsBalancerFiles({
        cancellationToken,
        logger,

        projectDirectoryUrl,
        balancerTemplateFileUrl,
        outDirectoryRelativeUrl,
        entryPointMap,
        bundleDirectoryUrl,
        bundleDefaultExtension,
        importMapFileRelativeUrl: compileServer.importMapFileRelativeUrl,
        compileServerOrigin,
        importDefaultExtension,
        externalImportSpecifiers,

        babelPluginMap,
        node,
        browser,
        format,
        formatInputOptions,
        formatOutputOptions,
        minify,
        writeOnFileSystem,
        sourcemapExcludeSources,
        manifestFile,
        systemJsScript,
      }),
    ])
  })
}

const assertEntryPointMap = ({ entryPointMap }) => {
  if (typeof entryPointMap !== "object") {
    throw new TypeError(`entryPointMap must be an object, got ${entryPointMap}`)
  }
  const keys = Object.keys(entryPointMap)
  keys.forEach((entryName) => {
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

const generateEntryPointsDirectories = ({
  compileServerGroupMap,
  bundleDirectoryUrl,
  outDirectoryRelativeUrl,
  ...rest
}) =>
  Promise.all(
    Object.keys(compileServerGroupMap).map((compileId) =>
      generateBundleUsingRollup({
        bundleDirectoryUrl: resolveDirectoryUrl(compileId, bundleDirectoryUrl),
        compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${compileId}/`,
        ...rest,
      }),
    ),
  )

const generateEntryPointsBalancerFiles = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  entryPointMap,
  balancerTemplateFileUrl,
  ...rest
}) =>
  Promise.all(
    Object.keys(entryPointMap).map((entryPointName) =>
      generateBundleUsingRollup({
        projectDirectoryUrl,
        compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/`,
        entryPointMap: {
          [entryPointName]: `./${urlToRelativeUrl(balancerTemplateFileUrl, projectDirectoryUrl)}`,
        },
        sourcemapExcludeSources: true,
        ...rest,
        format: "global",
      }),
    ),
  )
