import { createLogger, createDetailedMessage } from "@jsenv/logger"
import { resolveDirectoryUrl } from "@jsenv/filesystem"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"

import { COMPILE_ID_BEST } from "./internal/CONSTANTS.js"
import {
  assertProjectDirectoryUrl,
  assertProjectDirectoryExists,
} from "./internal/argUtils.js"
import { startCompileServer } from "./internal/compiling/startCompileServer.js"
import { buildUsingRollup } from "./internal/building/buildUsingRollup.js"
import {
  jsenvBrowserRuntimeSupport,
  jsenvNodeRuntimeSupport,
} from "./internal/generateGroupMap/jsenvRuntimeSupport.js"

export const buildProject = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  compileServerLogLevel = "warn",
  logger,

  projectDirectoryUrl,
  entryPointMap,
  buildDirectoryRelativeUrl,
  buildDirectoryClean = false,
  assetManifestFile = false,
  assetManifestFileRelativeUrl = "asset-manifest.json",
  sourcemapExcludeSources = false,
  writeOnFileSystem = true,

  format,
  systemJsUrl,
  globalName,
  globals = {},
  babelPluginMap = {},
  customCompilers,
  runtimeSupport = format === "global" ||
  format === "systemjs" ||
  format === "esmodule"
    ? jsenvBrowserRuntimeSupport
    : jsenvNodeRuntimeSupport,
  transformTopLevelAwait = true,

  urlMappings = {},
  importResolutionMethod = format === "commonjs" ? "node" : "importmap",
  importMapFileRelativeUrl,
  importDefaultExtension,
  externalImportSpecifiers = [],
  externalImportUrlPatterns = format === "commonjs"
    ? {
        "node_modules/": true,
      }
    : {},
  importPaths = {},

  urlVersioning = format === "systemjs" ||
    format === "esmodule" ||
    format === "global",
  lineBreakNormalization = process.platform === "win32",
  // when jsConcatenation is disabled rollup becomes almost useless
  // except it can still do tree shaking
  jsConcatenation = true,
  // useImportMapToMaximizeCacheReuse is enabled by default when entry point is an HTML file
  // otherwise it's disabled. It can still be explicitely enabled for non HTML entry file
  // in that case the returned buildImportMap must be injected into an html file
  useImportMapToMaximizeCacheReuse,
  preserveEntrySignatures,
  treeshake,

  minify = process.env.NODE_ENV === "production",
  // https://github.com/kangax/html-minifier#options-quick-reference
  minifyHtmlOptions = { collapseWhitespace: true, removeComments: true },
  // https://github.com/terser/terser#minify-options
  minifyJsOptions,
  // https://github.com/cssnano/cssnano/tree/master/packages/cssnano-preset-default
  minifyCssOptions,

  serviceWorkers = {},
  serviceWorkerFinalizer,

  env = {},
  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,

  // when true .jsenv/build directory is generated
  // with all intermediated files used to produce the final build files.
  // it might improve buildProject speed for subsequent build generation
  // but this is to be proven and not absolutely required
  // When false intermediates files are transformed and served in memory
  // by the compile server
  // must be true by default otherwise rollup cannot find sourcemap files
  // when asking them to the compile server
  // (to fix that sourcemap could be inlined)
  filesystemCache = true,
}) => {
  logger = logger || createLogger({ logLevel })
  if (!["esmodule", "systemjs", "commonjs", "global"].includes(format)) {
    throw new TypeError(
      `unexpected format: ${format}. Must be "esmodule", "systemjs", "commonjs" or "global".`,
    )
  }
  if (typeof runtimeSupport !== "object" || runtimeSupport === null) {
    throw new TypeError(
      `runtimeSupport must be an object, got ${runtimeSupport}`,
    )
  }

  projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
  await assertProjectDirectoryExists({ projectDirectoryUrl })

  assertEntryPointMap({ entryPointMap })

  if (Object.keys(entryPointMap).length === 0) {
    logger.error(`entryPointMap is an empty object`)
    return {
      rollupBuilds: {},
    }
  }

  assertBuildDirectoryRelativeUrl({ buildDirectoryRelativeUrl })
  const buildDirectoryUrl = resolveDirectoryUrl(
    buildDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  assertBuildDirectoryInsideProject({
    buildDirectoryUrl,
    projectDirectoryUrl,
  })

  const buildOperation = Abort.startOperation()
  buildOperation.addAbortSignal(signal)

  if (handleSIGINT) {
    buildOperation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      )
    })
  }

  const compileServer = await startCompileServer({
    signal: buildOperation.signal,
    compileServerLogLevel,

    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    jsenvDirectoryClean,
    // build compiled files are written into a different directory
    // than exploring-server. This is because here we compile for rollup
    // that is expecting esmodule format, not systemjs
    // + some more differences like import.meta.dev
    outDirectoryName: "build",
    importDefaultExtension,
    moduleOutFormat: "esmodule", // rollup or jsenv rollup plugin will transform into the right format
    importMetaFormat: "esmodule", // rollup or jsenv rollup plugin will transform into the right format

    compileServerProtocol,
    compileServerPrivateKey,
    compileServerCertificate,
    compileServerIp,
    compileServerPort,
    env,
    babelPluginMap,
    transformTopLevelAwait,
    customCompilers,
    runtimeSupport,

    compileServerCanReadFromFileSystem: filesystemCache,
    compileServerCanWriteOnFilesystem: filesystemCache,
    // keep source html untouched
    // here we don't need to inline importmap
    // nor to inject jsenv script
    transformHtmlSourceFiles: false,
  })

  buildOperation.addEndCallback(async () => {
    await compileServer.stop(`build cleanup`)
  })

  const { outDirectoryRelativeUrl, origin: compileServerOrigin } = compileServer

  try {
    const result = await buildUsingRollup({
      buildOperation,
      logger,

      entryPointMap,
      projectDirectoryUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${COMPILE_ID_BEST}/`,
      buildDirectoryUrl,
      buildDirectoryClean,
      assetManifestFile,
      assetManifestFileRelativeUrl,

      urlMappings,
      importResolutionMethod,
      importMapFileRelativeUrl,
      importDefaultExtension,
      externalImportSpecifiers,
      externalImportUrlPatterns,
      importPaths,

      format,
      systemJsUrl,
      globalName,
      globals,
      babelPluginMap,
      transformTopLevelAwait,
      runtimeSupport,

      urlVersioning,
      lineBreakNormalization,
      useImportMapToMaximizeCacheReuse,
      preserveEntrySignatures,
      treeshake,
      jsConcatenation,

      minify,
      minifyHtmlOptions,
      minifyJsOptions,
      minifyCssOptions,

      serviceWorkers,
      serviceWorkerFinalizer,

      writeOnFileSystem,
      sourcemapExcludeSources,
    })

    return result
  } catch (e) {
    if (Abort.isAbortError(e)) {
      logger.info("build aborted")
      return null
    }
    throw e
  } finally {
    await buildOperation.end()
  }
}

const assertEntryPointMap = ({ entryPointMap }) => {
  if (typeof entryPointMap !== "object") {
    throw new TypeError(`entryPointMap must be an object, got ${entryPointMap}`)
  }
  const keys = Object.keys(entryPointMap)
  keys.forEach((key) => {
    if (!key.startsWith("./")) {
      throw new TypeError(
        `unexpected key in entryPointMap, all keys must start with ./ but found ${key}`,
      )
    }

    const value = entryPointMap[key]
    if (typeof value !== "string") {
      throw new TypeError(
        `unexpected value in entryPointMap, all values must be strings found ${value} for key ${key}`,
      )
    }
    if (!value.startsWith("./")) {
      throw new TypeError(
        `unexpected value in entryPointMap, all values must starts with ./ but found ${value} for key ${key}`,
      )
    }
  })
}

const assertBuildDirectoryRelativeUrl = ({ buildDirectoryRelativeUrl }) => {
  if (typeof buildDirectoryRelativeUrl !== "string") {
    throw new TypeError(
      `buildDirectoryRelativeUrl must be a string, received ${buildDirectoryRelativeUrl}`,
    )
  }
}

const assertBuildDirectoryInsideProject = ({
  buildDirectoryUrl,
  projectDirectoryUrl,
}) => {
  if (!buildDirectoryUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(
      createDetailedMessage(
        `build directory must be inside project directory`,
        {
          ["build directory url"]: buildDirectoryUrl,
          ["project directory url"]: projectDirectoryUrl,
        },
      ),
    )
  }
}
