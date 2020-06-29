/* eslint-disable import/max-dependencies */
import { readFileSync } from "fs"
import { createCancellationToken } from "@jsenv/cancellation"
import { composeTwoImportMaps } from "@jsenv/import-map"
import { generateImportMapForPackage } from "@jsenv/node-module-import-map"
import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  firstService,
  serveFile,
} from "@jsenv/server"
import { createLogger } from "@jsenv/logger"
import {
  resolveUrl,
  urlToFileSystemPath,
  urlToRelativeUrl,
  resolveDirectoryUrl,
  readFile,
  writeFile,
  removeFileSystemNode,
  ensureEmptyDirectory,
  registerFileLifecycle,
  fileSystemPathToUrl,
  registerDirectoryLifecycle,
} from "@jsenv/util"
import { COMPILE_ID_GLOBAL_BUNDLE } from "../CONSTANTS.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { assertImportMapFileRelativeUrl, assertImportMapFileInsideProject } from "../argUtils.js"
import { babelPluginReplaceExpressions } from "../babel-plugin-replace-expressions.js"
import { generateGroupMap } from "../generateGroupMap/generateGroupMap.js"
import { jsenvBabelPluginCompatMap } from "../../jsenvBabelPluginCompatMap.js"
import { jsenvBrowserScoreMap } from "../../jsenvBrowserScoreMap.js"
import { jsenvNodeVersionScoreMap } from "../../jsenvNodeVersionScoreMap.js"
import { jsenvBabelPluginMap } from "../../jsenvBabelPluginMap.js"
import { require } from "../require.js"
import { createCallbackList } from "../createCallbackList.js"
import { readProjectImportMap } from "./readProjectImportMap.js"
import { createCompiledFileService } from "./createCompiledFileService.js"
import { urlIsAsset } from "./urlIsAsset.js"

export const startCompileServer = async ({
  cancellationToken = createCancellationToken(),
  compileServerLogLevel,

  // js compile options
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl = ".jsenv",
  jsenvDirectoryClean = false,
  outDirectoryName = "out",

  writeOnFilesystem = true,
  useFilesystemAsCache = true,
  compileCacheStrategy = "etag",

  importMapFileRelativeUrl = "importMap.json",
  importDefaultExtension,

  env = {},
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceProcessEnvNodeEnv = true,
  replaceGlobalObject = false,
  replaceGlobalFilename = false,
  replaceGlobalDirname = false,
  replaceMap = {},

  babelPluginMap = jsenvBabelPluginMap,
  convertMap = {},

  // options related to the server itself
  compileServerProtocol = "https",
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp = "0.0.0.0",
  compileServerPort = 0,
  keepProcessAlive = false,
  stopOnPackageVersionChange = false,

  // remaining options are complex or private
  compileGroupCount = 1,
  babelCompatMap = jsenvBabelPluginCompatMap,
  browserScoreMap = jsenvBrowserScoreMap,
  nodeVersionScoreMap = jsenvNodeVersionScoreMap,
  runtimeAlwaysInsideRuntimeScoreMap = false,
}) => {
  ;({ importMapFileRelativeUrl } = assertAndNormalizeArguments({
    projectDirectoryUrl,
    importMapFileRelativeUrl,
    jsenvDirectoryRelativeUrl,
  }))

  const jsenvDirectoryUrl = resolveDirectoryUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl)
  const outDirectoryUrl = resolveDirectoryUrl(outDirectoryName, jsenvDirectoryUrl)
  const outDirectoryRelativeUrl = urlToRelativeUrl(outDirectoryUrl, projectDirectoryUrl)
  const logger = createLogger({ logLevel: compileServerLogLevel })
  babelPluginMap = {
    "transform-replace-expressions": [
      babelPluginReplaceExpressions,
      {
        replaceMap: {
          ...(replaceProcessEnvNodeEnv
            ? { "process.env.NODE_ENV": `("${processEnvNodeEnv}")` }
            : {}),
          ...(replaceGlobalObject ? { global: "globalThis" } : {}),
          ...(replaceGlobalFilename ? { __filename: __filenameReplacement } : {}),
          ...(replaceGlobalDirname ? { __dirname: __dirnameReplacement } : {}),
          ...replaceMap,
        },
        allowConflictingReplacements: true,
      },
    ],
    ...babelPluginMap,
  }
  const groupMap = generateGroupMap({
    babelPluginMap,
    babelCompatMap,
    runtimeScoreMap: { ...browserScoreMap, node: nodeVersionScoreMap },
    groupCount: compileGroupCount,
    runtimeAlwaysInsideRuntimeScoreMap,
  })
  const importMapForCompileServer = await generateImportMapForCompileServer({
    logger,
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    importMapFileRelativeUrl,
  })

  await setupOutDirectory(outDirectoryUrl, {
    logger,
    jsenvDirectoryUrl,
    jsenvDirectoryClean,
    useFilesystemAsCache,
    babelPluginMap,
    convertMap,
    groupMap,
  })

  const { projectFileRequestedCallback } = await setupLivereloading()

  const browserJsFileUrl = resolveUrl(
    "./src/internal/browser-launcher/jsenv-browser-system.js",
    jsenvCoreDirectoryUrl,
  )
  const browserjsFileRelativeUrl = urlToRelativeUrl(browserJsFileUrl, projectDirectoryUrl)
  const browserBundledJsFileRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_GLOBAL_BUNDLE}/${browserjsFileRelativeUrl}`

  const serveAssetFile = createAssetFileService({ projectDirectoryUrl })
  const serveBrowserScript = createBrowserScriptService({
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    browserBundledJsFileRelativeUrl,
  })
  const serveCompiledFile = createCompiledFileService({
    cancellationToken,
    logger,

    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    browserBundledJsFileRelativeUrl,
    compileServerImportMap: importMapForCompileServer,
    importMapFileRelativeUrl,
    importDefaultExtension,

    transformTopLevelAwait,
    transformModuleIntoSystemFormat,
    babelPluginMap,
    groupMap,
    convertMap,

    projectFileRequestedCallback,
    useFilesystemAsCache,
    writeOnFilesystem,
    compileCacheStrategy,
  })
  const serveProjectFile = createProjectFileService({ projectDirectoryUrl })

  const compileServer = await startServer({
    cancellationToken,
    logLevel: compileServerLogLevel,
    serverName: "compile server",

    protocol: compileServerProtocol,
    privateKey: compileServerPrivateKey,
    certificate: compileServerCertificate,
    ip: compileServerIp,
    port: compileServerPort,
    sendInternalErrorStack: true,
    requestToResponse: (request) =>
      firstService(
        () => serveAssetFile(request),
        () => serveBrowserScript(request),
        () => serveCompiledFile(request),
        () => serveProjectFile(request),
      ),
    accessControlAllowRequestOrigin: true,
    accessControlAllowRequestMethod: true,
    accessControlAllowRequestHeaders: true,
    accessControlAllowedRequestHeaders: [
      ...jsenvAccessControlAllowedHeaders,
      "x-jsenv-execution-id",
    ],
    accessControlAllowCredentials: true,
    keepProcessAlive,
  })

  await installOutFiles(compileServer, {
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,
    importMapFileRelativeUrl,
    importMapForCompileServer,
    groupMap,
    env,
    writeOnFilesystem,
  })

  if (stopOnPackageVersionChange) {
    installStopOnPackageVersionChange(compileServer, {
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
    })
  }

  return {
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importMapFileRelativeUrl,
    ...compileServer,
    compileServerImportMap: importMapForCompileServer,
    compileServerGroupMap: groupMap,
  }
}

const assertAndNormalizeArguments = ({
  projectDirectoryUrl,
  importMapFileRelativeUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryName,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string. got ${projectDirectoryUrl}`)
  }

  assertImportMapFileRelativeUrl({ importMapFileRelativeUrl })
  const importMapFileUrl = resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl)
  assertImportMapFileInsideProject({ importMapFileUrl, projectDirectoryUrl })
  // importMapFileRelativeUrl normalization
  importMapFileRelativeUrl = urlToRelativeUrl(importMapFileUrl, projectDirectoryUrl)

  if (typeof jsenvDirectoryRelativeUrl !== "string") {
    throw new TypeError(
      `jsenvDirectoryRelativeUrl must be a string. got ${jsenvDirectoryRelativeUrl}`,
    )
  }
  const jsenvDirectoryUrl = resolveDirectoryUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl)
  // jsenvDirectoryRelativeUrl normalization
  jsenvDirectoryRelativeUrl = urlToRelativeUrl(jsenvDirectoryUrl, projectDirectoryUrl)
  if (!jsenvDirectoryUrl.startsWith(projectDirectoryUrl)) {
    throw new TypeError(`jsenv directory must be inside project directory
--- jsenv directory url ---
${jsenvDirectoryUrl}
--- project directory url ---
${projectDirectoryUrl}`)
  }

  if (typeof outDirectoryName !== "string") {
    throw new TypeError(`outDirectoryName must be a string. got ${outDirectoryName}`)
  }

  return { importMapFileRelativeUrl }
}

/**
 * generateImportMapForCompileServer allows the following:
 *
 * import importMap from '/.jsenv/importMap.json'
 *
 * returns jsenv internal importMap and
 *
 * import importMap from '/importMap.json'
 *
 * returns the project importMap.
 * Note that if importMap file does not exists an empty object is returned.
 * Note that if project uses a custom importMapFileRelativeUrl jsenv internal import map
 * remaps '/importMap.json' to the real importMap
 *
 * This pattern exists so that jsenv can resolve some dynamically injected import such as
 *
 * @jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js
 */
const generateImportMapForCompileServer = async ({
  logger,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  importMapFileRelativeUrl,
}) => {
  const importMapForJsenvCore = await generateImportMapForPackage({
    logger,
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    rootProjectDirectoryUrl: projectDirectoryUrl,
    includeImports: true,
    includeExports: true,
  })
  const importmapForSelfImport = {
    imports: {
      "@jsenv/core/": `./${urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl)}`,
    },
  }
  const importMapInternal = {
    imports: {
      ...(outDirectoryRelativeUrl === ".jsenv/out/"
        ? {}
        : {
            "/.jsenv/out/": `./${outDirectoryRelativeUrl}`,
          }),
      // in case importMapFileRelativeUrl is not the default
      // redirect /importMap.json to the proper location
      ...(importMapFileRelativeUrl === "importMap.json"
        ? {}
        : {
            "/importMap.json": `./${importMapFileRelativeUrl}`,
          }),
    },
  }
  const importMapForProject = await readProjectImportMap({
    projectDirectoryUrl,
    importMapFileRelativeUrl,
  })
  const importMap = [
    importMapForJsenvCore,
    importmapForSelfImport,
    importMapInternal,
    importMapForProject,
  ].reduce((previous, current) => composeTwoImportMaps(previous, current), {})
  return importMap
}

const setupOutDirectory = async (
  outDirectoryUrl,
  {
    logger,
    jsenvDirectoryClean,
    jsenvDirectoryUrl,
    useFilesystemAsCache,
    babelPluginMap,
    convertMap,
    groupMap,
  },
) => {
  if (jsenvDirectoryClean) {
    logger.info(`clean jsenv directory at ${jsenvDirectoryUrl}`)
    await ensureEmptyDirectory(jsenvDirectoryUrl)
  }
  if (useFilesystemAsCache) {
    const jsenvCorePackageFileUrl = resolveUrl("./package.json", jsenvCoreDirectoryUrl)
    const jsenvCorePackageFilePath = urlToFileSystemPath(jsenvCorePackageFileUrl)
    const jsenvCorePackageVersion = readPackage(jsenvCorePackageFilePath).version
    const outDirectoryMeta = {
      jsenvCorePackageVersion,
      babelPluginMap,
      convertMap,
      groupMap,
    }
    const metaFileUrl = resolveUrl("./meta.json", outDirectoryUrl)

    let previousOutDirectoryMeta
    try {
      const source = await readFile(metaFileUrl)
      previousOutDirectoryMeta = JSON.parse(source)
    } catch (e) {
      if (e && e.code === "ENOENT") {
        previousOutDirectoryMeta = null
      } else {
        throw e
      }
    }

    if (previousOutDirectoryMeta !== null) {
      const previousMetaString = JSON.stringify(previousOutDirectoryMeta, null, "  ")
      const metaString = JSON.stringify(outDirectoryMeta, null, "  ")
      if (previousMetaString !== metaString) {
        if (!jsenvDirectoryClean) {
          logger.warn(`clean out directory at ${urlToFileSystemPath(outDirectoryUrl)}`)
        }
        await ensureEmptyDirectory(outDirectoryUrl)
      }
    }

    await writeFile(metaFileUrl, JSON.stringify(outDirectoryMeta, null, "  "))
  }
}

const setupLivereloading = (
  compileServer,
  { cancellationToken, projectDirectoryUrl, watchConfig },
) => {
  // const roomSet = new Set()
  // const trackerSet = new Set()
  // const projectFileRequested = createCallbackList()
  const projectFileUpdated = createCallbackList()
  const projectFileRemoved = createCallbackList()

  const projectFileRequestedCallback = (relativeUrl) => {
    // I doubt an asset like .js.map will change
    // in theory a compilation asset should not change
    // if the source file did not change
    // so we can avoid watching compilation asset
    if (urlIsAsset(`${projectDirectoryUrl}${relativeUrl}`)) {
      return
    }
  }
  const unregisterDirectoryLifecyle = registerDirectoryLifecycle(projectDirectoryUrl, {
    watchDescription: {
      ...watchConfig,
      [compileServer.jsenvDirectoryRelativeUrl]: false,
    },
    updated: ({ relativeUrl }) => {
      projectFileUpdated.notify(relativeUrl)
    },
    removed: ({ relativeUrl }) => {
      projectFileRemoved.notify(relativeUrl)
    },
    keepProcessAlive: false,
    recursive: true,
  })
  cancellationToken.register(unregisterDirectoryLifecyle)

  return { projectFileRequestedCallback }
}

const createAssetFileService = ({ projectDirectoryUrl }) => {
  return (request) => {
    const { origin, ressource, method, headers } = request
    const requestUrl = `${origin}${ressource}`
    if (urlIsAsset(requestUrl)) {
      return serveFile(resolveUrl(ressource.slice(1), projectDirectoryUrl), {
        method,
        headers,
      })
    }
    return null
  }
}

const createBrowserScriptService = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  browserBundledJsFileRelativeUrl,
}) => {
  const sourcemapMainFileUrl = fileSystemPathToUrl(require.resolve("source-map/dist/source-map.js"))
  const sourcemapMappingFileUrl = fileSystemPathToUrl(
    require.resolve("source-map/lib/mappings.wasm"),
  )
  const sourcemapMainFileRelativeUrl = urlToRelativeUrl(sourcemapMainFileUrl, projectDirectoryUrl)
  const sourcemapMappingFileRelativeUrl = urlToRelativeUrl(
    sourcemapMappingFileUrl,
    projectDirectoryUrl,
  )

  return (request) => {
    if (request.headers["x-jsenv-exploring"]) {
      const body = JSON.stringify({
        outDirectoryRelativeUrl,
        errorStackRemapping: true,
        sourcemapMainFileRelativeUrl,
        sourcemapMappingFileRelativeUrl,
      })

      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
        body,
      }
    }

    if (request.ressource === "/.jsenv/browser-script.js") {
      const browserBundledJsFileRemoteUrl = `${request.origin}/${browserBundledJsFileRelativeUrl}`

      return {
        status: 307,
        headers: {
          location: browserBundledJsFileRemoteUrl,
        },
      }
    }

    return null
  }
}

const createProjectFileService = ({ projectDirectoryUrl, projectFileRequestedCallback }) => {
  return (request) => {
    const { ressource, method, headers } = request
    const relativeUrl = ressource.slice(1)
    projectFileRequestedCallback(relativeUrl, request)

    const fileUrl = resolveUrl(relativeUrl, projectDirectoryUrl)
    const filePath = urlToFileSystemPath(fileUrl)

    const responsePromise = serveFile(filePath, {
      method,
      headers,
    })

    return responsePromise
  }
}

const installOutFiles = async (
  compileServer,
  {
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,
    importMapFileRelativeUrl,
    importMapForCompileServer,
    groupMap,
    env,
    writeOnFilesystem,
  },
) => {
  const outDirectoryUrl = resolveUrl(outDirectoryRelativeUrl, projectDirectoryUrl)

  env = {
    ...env,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,
    importMapFileRelativeUrl,
  }

  const importMapToString = () => JSON.stringify(importMapForCompileServer, null, "  ")
  const groupMapToString = () => JSON.stringify(groupMap, null, "  ")
  const envToString = () => JSON.stringify(env, null, "  ")

  const groupMapOutFileUrl = resolveUrl("./groupMap.json", outDirectoryUrl)
  const envOutFileUrl = resolveUrl("./env.json", outDirectoryUrl)
  const importmapFiles = Object.keys(groupMap).map((compileId) => {
    return resolveUrl(importMapFileRelativeUrl, `${outDirectoryUrl}${compileId}/`)
  })

  await Promise.all([
    writeFile(groupMapOutFileUrl, groupMapToString()),
    writeFile(envOutFileUrl, envToString()),
    ...importmapFiles.map((importmapFile) => writeFile(importmapFile, importMapToString())),
  ])

  if (!writeOnFilesystem) {
    compileServer.stoppedPromise.then(() => {
      importmapFiles.forEach((importmapFile) => {
        removeFileSystemNode(importmapFile, { allowUseless: true })
      })
      removeFileSystemNode(groupMapOutFileUrl, { allowUseless: true })
      removeFileSystemNode(envOutFileUrl)
    })
  }
}

const installStopOnPackageVersionChange = (
  compileServer,
  { projectDirectoryUrl, jsenvDirectoryRelativeUrl },
) => {
  const jsenvCoreDirectoryUrl = resolveUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl)
  const packageFileUrl = resolveUrl("./package.json", jsenvCoreDirectoryUrl)
  const packageFilePath = urlToFileSystemPath(packageFileUrl)
  const packageVersion = readPackage(packageFilePath).version

  const checkPackageVersion = () => {
    let packageObject
    try {
      packageObject = readPackage(packageFilePath)
    } catch (e) {
      // package json deleted ? not a problem
      // let's wait for it to show back
      if (e.code === "ENOENT") return
      // package.json malformed ? not a problem
      // let's wait for use to fix it or filesystem to finish writing the file
      if (e.name === "SyntaxError") return
      throw e
    }

    if (packageVersion !== packageObject.version) {
      compileServer.stop(STOP_REASON_PACKAGE_VERSION_CHANGED)
    }
  }

  const unregister = registerFileLifecycle(packageFilePath, {
    added: checkPackageVersion,
    updated: checkPackageVersion,
    keepProcessAlive: false,
  })
  compileServer.stoppedPromise.then(
    () => {
      unregister()
    },
    () => {},
  )
}

const readPackage = (packagePath) => {
  const buffer = readFileSync(packagePath)
  const string = String(buffer)
  const packageObject = JSON.parse(string)
  return packageObject
}

export const STOP_REASON_PACKAGE_VERSION_CHANGED = {
  toString: () => `package version changed`,
}

const __filenameReplacement = `import.meta.url.slice('file:///'.length)`

const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`
