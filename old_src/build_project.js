import { resolveDirectoryUrl } from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"

import {
  assertProjectDirectoryUrl,
  assertProjectDirectoryExists,
} from "@jsenv/core/src/internal/jsenv_params_assertions.js"
import { startCompileServer } from "@jsenv/core/src/internal/compile_server/compile_server.js"
import { buildUsingRollup } from "@jsenv/core/src/internal/building/build_using_rollup.js"
import {
  jsenvBrowserRuntimeSupport,
  jsenvNodeRuntimeSupport,
} from "@jsenv/core/src/internal/runtime_support/jsenv_runtime_support.js"
import {
  isNodePartOfSupportedRuntimes,
  isBrowserPartOfSupportedRuntimes,
} from "@jsenv/core/src/internal/runtime_support/runtime_support.js"

/**
 * Generate optimized version of source files into a directory
 * @param {Object} buildProjectParameters
 * @param {string|url} buildProjectParameters.projectDirectoryUrl Root directory of the project
 * @param {string|url} buildProjectParameters.buildDirectoryRelativeUrl Directory where optimized files are written
 * @param {object} buildProjectParameters.entryPoints Describe entry point paths and control their names in the build directory
 * @param {"esmodule" | "systemjs" | "commonjs" | "global"} buildProjectParameters.format Code generated will use this module format
 * @param {object} buildProjectParameters.runtimeSupport Code generated will be compatible with these runtimes
 * @param {boolean} [buildProjectParameters.minify=false] Minify file content in the build directory (HTML, CSS, JS, JSON, SVG)
 * @return {Object} An object containing the result of building files
 */

export const buildProject = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  compileServerLogLevel = "warn",
  logger,

  projectDirectoryUrl,
  entryPoints,
  serviceWorkerFinalizer,
  importMapInWebWorkers = false,
  buildDirectoryRelativeUrl,
  buildDirectoryClean = true,
  assetManifestFile = false,
  assetManifestFileRelativeUrl = "asset-manifest.json",
  sourcemapExcludeSources = false,
  writeOnFileSystem = true,

  format,
  systemJsUrl,
  globals = {},
  preservedDynamicImports = {},

  babelPluginMap = {},
  babelConfigFile,
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
  preservedUrls = {},
  // https://rollupjs.org/guide/en/#outputpaths
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
  if (format !== "systemjs" && importMapInWebWorkers) {
    throw new Error(
      `format must be "systemjs" when importMapInWebWorkers is enabled`,
    )
  }
  projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
  await assertProjectDirectoryExists({ projectDirectoryUrl })
  assertEntryPoints({ entryPoints })
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
    prependSystemJs: false,

    protocol,
    privateKey,
    certificate,
    ip,
    port,

    babelPluginMap,
    babelConfigFile,
    runtimeSupport,
    customCompilers,
    preservedUrls: {
      // when format is commonjs preserve node_modules files
      // because code generated expects to be installed alongside its dependencies and require them
      "./node_modules/": format === "commonjs",
      "./node_modules/@jsenv/core/helpers/": false,
      // However it's possible to pass http url in there to "handle" a remote url (http(s)://*)
      // In that case the remote url is fetched and becomes a file in the build directory
      ...preservedUrls,
    },
    // keep source html untouched
    // here we don't need to inline importmap
    // nor to inject event_source_client, html_supervisor or toolbar
    preserveHtmlSourceFiles: true,
    compileServerCanReadFromFilesystem: filesystemCache,
    compileServerCanWriteOnFilesystem: filesystemCache,
  })
  buildOperation.addEndCallback(async () => {
    await compileServer.stop(`build cleanup`)
  })
  const node = isNodePartOfSupportedRuntimes(runtimeSupport)
  const browser = isBrowserPartOfSupportedRuntimes(runtimeSupport)
  const { compileId, compileProfile } =
    await compileServer.createCompileIdFromRuntimeReport({
      env: {
        browser,
        node,
      },
      name: "jsenv_build",
      version: "1",
      runtimeSupport,
      // "rollup_plugin_jsenv.js" expects to hit the compile server
      // so we force compilation by adding a fake feature called "force_compilation"
      // one day we'll test how code behaves if zero transformations is required during
      // the build and update code as needed
      forceCompilation: true,
    })

  try {
    const result = await buildUsingRollup({
      buildOperation,
      logger,

      entryPoints,
      projectDirectoryUrl,
      buildDirectoryUrl,
      buildDirectoryClean,
      assetManifestFile,
      assetManifestFileRelativeUrl,

      urlMappings,
      importResolutionMethod,
      importMapFileRelativeUrl,
      importDefaultExtension,
      externalImportSpecifiers,
      preservedUrls: compileServer.preservedUrls,
      importPaths,

      format,
      systemJsUrl,
      globals,
      preservedDynamicImports,
      serviceWorkerFinalizer,

      node,
      browser,
      compileServer,
      compileProfile,
      compileId,

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

const assertEntryPoints = ({ entryPoints }) => {
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
