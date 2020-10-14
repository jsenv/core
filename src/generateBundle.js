import { createLogger } from "@jsenv/logger"
import {
  resolveDirectoryUrl,
  ensureEmptyDirectory,
  createCancellationTokenForProcess,
} from "@jsenv/util"
import { wrapExternalFunctionExecution } from "./internal/wrapExternalFunctionExecution.js"
import { COMPILE_ID_OTHERWISE } from "./internal/CONSTANTS.js"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "./internal/argUtils.js"
import { startCompileServer } from "./internal/compiling/startCompileServer.js"
import { createBabePluginMapForBundle } from "./internal/bundling/createBabePluginMapForBundle.js"
import { generateBundleUsingRollup } from "./internal/bundling/generateBundleUsingRollup.js"
import { jsenvBabelPluginMap } from "./jsenvBabelPluginMap.js"

//  minify: process.env.NODE_ENV === "production",
//       minifyHtmlOptions: {
//         collapseWhitespace: true,
//       },
// https://github.com/terser/terser#minify-options
// minifyJsOptions,
// // https://github.com/jakubpawlowicz/clean-css#constructor-options
// minifyCssOptions,
// // https://github.com/kangax/html-minifier#options-quick-reference
// minifyHtmlOptions,

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
  browser,
  node,

  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap = jsenvBabelPluginMap,

  entryPointMap = {
    "./index.js": "./index.js",
  },
  format = "esm",
  globalName,
  globals = {},
  sourcemapExcludeSources = false,
  bundleDirectoryRelativeUrl,
  bundleDirectoryClean = false,
  bundleDefaultExtension,
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

    if (format === "esm") {
      if (bundleDirectoryRelativeUrl === undefined) {
        bundleDirectoryRelativeUrl = "./dist/esm"
      }
    } else if (format === "systemjs") {
      if (bundleDirectoryRelativeUrl === undefined) {
        bundleDirectoryRelativeUrl = "./dist/systemjs"
      }
    } else if (format === "commonjs") {
      if (bundleDirectoryRelativeUrl === undefined) {
        bundleDirectoryRelativeUrl = "./dist/commonjs"
      }
      if (bundleDefaultExtension === undefined) {
        bundleDefaultExtension = ".cjs"
      }
      if (node === undefined) {
        node = true
      }
    } else if (format === "global") {
      if (bundleDirectoryRelativeUrl === undefined) {
        bundleDirectoryRelativeUrl = "./dist/global"
      }
      if (browser === undefined) {
        browser = true
      }
    } else {
      throw new TypeError(
        `unexpected format: ${format}. Must be esm, systemjs, commonjs or global.`,
      )
    }

    if (bundleDefaultExtension === undefined) {
      bundleDefaultExtension = ".js"
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

    assertBundleDirectoryRelativeUrl({ bundleDirectoryRelativeUrl })
    const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativeUrl, projectDirectoryUrl)
    assertBundleDirectoryInsideProject({ bundleDirectoryUrl, projectDirectoryUrl })
    if (bundleDirectoryClean) {
      await ensureEmptyDirectory(bundleDirectoryUrl)
    }

    babelPluginMap = {
      ...babelPluginMap,
      ...createBabePluginMapForBundle({
        format,
      }),
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
      writeOnFilesystem: filesystemCache,
      useFilesystemAsCache: filesystemCache,

      // override with potential custom options
      ...rest,

      transformModuleIntoSystemFormat: false, // will be done by rollup
    })

    const { outDirectoryRelativeUrl, origin: compileServerOrigin } = compileServer

    return generateBundleUsingRollup({
      cancellationToken,
      logger,

      entryPointMap,
      projectDirectoryUrl,
      importMapFileRelativeUrl: compileServer.importMapFileRelativeUrl,
      compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/`,
      compileServerOrigin,
      importDefaultExtension,
      externalImportSpecifiers,
      babelPluginMap,
      node,
      browser,
      writeOnFileSystem,

      format,
      globalName,
      globals,
      sourcemapExcludeSources,
      bundleDirectoryUrl,
      bundleDefaultExtension,
      manifestFile,
    })
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
