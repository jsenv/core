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
  entryPoints,
  workers = {},
  serviceWorkers = {},
  serviceWorkerFinalizer,
  classicWorkers = {},
  classicServiceWorkers = {},
  buildDirectoryRelativeUrl,
  buildDirectoryClean = true,
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
  cssConcatenation = false,
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

  env = {},
  protocol,
  privateKey,
  certificate,
  ip,
  port,
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

  assertentryPoints({ entryPoints })

  if (Object.keys(entryPoints).length === 0) {
    logger.error(`entryPoints is an empty object`)
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
    logLevel: compileServerLogLevel,

    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    jsenvDirectoryClean,
    // build compiled files are written into a different directory
    // than dev-server. This is because here we compile for rollup
    // that is expecting esmodule format, not systemjs
    outDirectoryName: "build",
    importDefaultExtension,
    moduleOutFormat: "esmodule", // rollup will transform into the right format
    importMetaFormat: "esmodule", // rollup will transform into the right format
    topLevelAwait: "ignore", // rollup will transform if needed

    protocol,
    privateKey,
    certificate,
    ip,
    port,
    env,
    babelPluginMap,
    runtimeSupport,
    customCompilers,
    compileServerCanReadFromFilesystem: filesystemCache,
    compileServerCanWriteOnFilesystem: filesystemCache,
    // keep source html untouched
    // here we don't need to inline importmap
    // nor to inject jsenv script
    transformHtmlSourceFiles: false,
    jsenvScriptInjection: false,
    jsenvEventSourceClientInjection: false,
  })

  buildOperation.addEndCallback(async () => {
    await compileServer.stop(`build cleanup`)
  })

  const { outDirectoryRelativeUrl, origin: compileServerOrigin } = compileServer

  try {
    const result = await buildUsingRollup({
      buildOperation,
      logger,

      entryPoints,
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
      babelPluginMap: compileServer.babelPluginMap,
      runtimeSupport,
      workers,
      serviceWorkers,
      serviceWorkerFinalizer,
      classicWorkers,
      classicServiceWorkers,

      urlVersioning,
      lineBreakNormalization,
      useImportMapToMaximizeCacheReuse,
      preserveEntrySignatures,
      treeshake,
      jsConcatenation,
      cssConcatenation,

      minify,
      minifyHtmlOptions,
      minifyJsOptions,
      minifyCssOptions,

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

const assertentryPoints = ({ entryPoints }) => {
  if (typeof entryPoints !== "object") {
    throw new TypeError(`entryPoints must be an object, got ${entryPoints}`)
  }
  const keys = Object.keys(entryPoints)
  keys.forEach((key) => {
    if (!key.startsWith("./")) {
      throw new TypeError(
        `unexpected key in entryPoints, all keys must start with ./ but found ${key}`,
      )
    }

    const value = entryPoints[key]
    if (typeof value !== "string") {
      throw new TypeError(
        `unexpected value in entryPoints, all values must be strings found ${value} for key ${key}`,
      )
    }
    if (value.includes("/")) {
      throw new TypeError(
        `unexpected value in entryPoints, all values must be plain strings (no "/") but found ${value} for key ${key}`,
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
