import { createLogger } from "@jsenv/logger"
import { createCancellationTokenForProcess } from "@jsenv/cancellation"
import { resolveDirectoryUrl } from "@jsenv/util"
import { executeJsenvAsyncFunction } from "./internal/executeJsenvAsyncFunction.js"
import { COMPILE_ID_OTHERWISE } from "./internal/CONSTANTS.js"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "./internal/argUtils.js"
import { startCompileServer } from "./internal/compiling/startCompileServer.js"
import { generateBundleUsingRollup } from "./internal/bundling/generateBundleUsingRollup.js"
import { jsenvBabelPluginMap } from "./jsenvBabelPluginMap.js"

const FORMAT_ENTRY_POINTS = {
  commonjs: { "./main.js": "./main.cjs" },
  systemjs: { "./main.html": "./main.html" },
  global: { "./main.js": "./main.js" },
  esmodule: { "./main.html": "./main.html" },
}

// TODO: rename buildProject
export const generateBundle = async ({
  cancellationToken = createCancellationTokenForProcess(),
  logLevel = "info",
  compileServerLogLevel = "warn",
  logger,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importMetaEnvFileRelativeUrl,
  importMeta = {
    dev: false,
  },
  importDefaultExtension,
  externalImportSpecifiers = [],
  env = {},

  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap = jsenvBabelPluginMap,

  format = "esmodule",
  externalImportUrlPatterns = format === "commonjs"
    ? {
        "node_modules/": true,
      }
    : {},
  browser = format === "global" || format === "systemjs" || format === "esmodule",
  node = format === "commonjs",
  entryPointMap = FORMAT_ENTRY_POINTS[format],
  systemJsUrl = "/node_modules/systemjs/dist/s.min.js",
  globalName,
  globals = {},
  sourcemapExcludeSources = false,

  buildDirectoryRelativeUrl,
  buildDirectoryClean = false,
  writeOnFileSystem = true,
  manifestFile = false,

  longTermCaching = true,
  useImportMapToImproveLongTermCaching = format === "systemjs",
  preserveEntrySignatures,
  jsConcatenation = true,
  minify = process.env.NODE_ENV === "production",
  // https://github.com/kangax/html-minifier#options-quick-reference
  minifyHtmlOptions = { collapseWhitespace: true },
  // https://github.com/terser/terser#minify-options
  minifyJsOptions,
  // https://github.com/cssnano/cssnano/tree/master/packages/cssnano-preset-default
  minifyCssOptions,

  // when true .jsenv/out-build directory is generated
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
  return executeJsenvAsyncFunction(async () => {
    logger = logger || createLogger({ logLevel })

    if (format === "esmodule") {
      if (buildDirectoryRelativeUrl === undefined) {
        buildDirectoryRelativeUrl = "./dist/esmodule"
      }
    } else if (format === "systemjs") {
      if (buildDirectoryRelativeUrl === undefined) {
        buildDirectoryRelativeUrl = "./dist/systemjs"
      }
    } else if (format === "commonjs") {
      if (buildDirectoryRelativeUrl === undefined) {
        buildDirectoryRelativeUrl = "./dist/commonjs"
      }
      if (node === undefined) {
        node = true
      }
    } else if (format === "global") {
      if (buildDirectoryRelativeUrl === undefined) {
        buildDirectoryRelativeUrl = "./dist/global"
      }
      if (browser === undefined) {
        browser = true
      }
    } else {
      throw new TypeError(
        `unexpected format: ${format}. Must be esmodule, systemjs, commonjs or global.`,
      )
    }

    if (!jsConcatenation) {
      throw new Error(
        `jsConcatenation cannot be disabled for now. See https://github.com/rollup/rollup/issues/3882`,
      )
    }

    projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
    await assertProjectDirectoryExists({ projectDirectoryUrl })

    assertEntryPointMap({ entryPointMap })

    if (Object.keys(entryPointMap).length === 0) {
      logger.error(`entryPointMap is an empty object`)
      return {
        rollupBundles: {},
      }
    }

    assertbuildDirectoryRelativeUrl({ buildDirectoryRelativeUrl })
    const bundleDirectoryUrl = resolveDirectoryUrl(buildDirectoryRelativeUrl, projectDirectoryUrl)
    assertBundleDirectoryInsideProject({ bundleDirectoryUrl, projectDirectoryUrl })

    const compileServer = await startCompileServer({
      cancellationToken,
      compileServerLogLevel,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      // build compiled files are written into a different directory
      // than exploring-server. This is because here we compile for rollup
      // that is expecting esmodule format, not systemjs
      // + some more differences like import.meta.dev
      outDirectoryName: "out-build",
      importMapFileRelativeUrl,
      importDefaultExtension,
      importMetaEnvFileRelativeUrl,
      importMeta,
      moduleOutFormat: "esmodule", // rollup will transform into systemjs
      importMetaFormat: format, // but ensure import.meta are correctly transformed into the right format

      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      env,
      babelPluginMap,

      writeOnFilesystem: filesystemCache,
      useFilesystemAsCache: filesystemCache,

      // override with potential custom options
      ...rest,
    })

    const { outDirectoryRelativeUrl, origin: compileServerOrigin } = compileServer

    try {
      const result = await generateBundleUsingRollup({
        cancellationToken,
        logger,

        entryPointMap,
        projectDirectoryUrl,
        importMapFileRelativeUrl: compileServer.importMapFileRelativeUrl,
        compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/`,
        compileServerOrigin,
        importDefaultExtension,
        externalImportSpecifiers,
        externalImportUrlPatterns,
        babelPluginMap,
        node,
        browser,
        writeOnFileSystem,

        format,
        systemJsUrl,
        globalName,
        globals,
        sourcemapExcludeSources,

        bundleDirectoryUrl,
        buildDirectoryClean,
        manifestFile,

        longTermCaching,
        useImportMapToImproveLongTermCaching,
        preserveEntrySignatures,
        jsConcatenation,
        minify,
        minifyHtmlOptions,
        minifyJsOptions,
        minifyCssOptions,
      })
      return result
    } finally {
      compileServer.stop("bundle generated")
    }
  })
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

const assertbuildDirectoryRelativeUrl = ({ buildDirectoryRelativeUrl }) => {
  if (typeof buildDirectoryRelativeUrl !== "string") {
    throw new TypeError(
      `buildDirectoryRelativeUrl must be a string, received ${buildDirectoryRelativeUrl}`,
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
