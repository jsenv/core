/* eslint-disable import/max-dependencies */
import { readFileSync } from "fs"
import { createCancellationToken } from "@jsenv/cancellation"
import { registerFileLifecycle } from "@jsenv/file-watcher"
import { createLogger } from "@jsenv/logger"
import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  firstService,
  serveFile,
} from "@jsenv/server"
import { resolveFileUrl, fileUrlToPath } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { generateGroupMap } from "internal/generateGroupMap/generateGroupMap.js"
import { jsenvBabelPluginCompatMap } from "src/jsenvBabelPluginCompatMap.js"
import { jsenvBrowserScoreMap } from "src/jsenvBrowserScoreMap.js"
import { jsenvNodeVersionScoreMap } from "src/jsenvNodeVersionScoreMap.js"
import { jsenvBabelPluginMap } from "src/jsenvBabelPluginMap.js"
import { cleanCompileDirectoryIfObsolete } from "./compile-directory/cleanCompileDirectoryIfObsolete.js"
import { serveBrowserPlatform } from "./serveBrowserPlatform.js"
import { serveNodePlatform } from "./serveNodePlatform.js"
import { serveCompiledJs } from "./serveCompiledJs.js"
import { urlIsAsset } from "./urlIsAsset.js"

export const startCompileServer = async ({
  cancellationToken = createCancellationToken(),
  logLevel,

  // js compile options
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,

  projectDirectoryUrl,

  compileDirectoryUrl,
  compileDirectoryClean = false,
  writeOnFilesystem = true,
  useFilesystemAsCache = true,

  importMapFileUrl,
  importDefaultExtension,
  babelPluginMap = jsenvBabelPluginMap,
  convertMap = {},

  // options related to the server itself
  protocol = "http",
  privateKey,
  certificate,
  ip = "127.0.0.1",
  port = 0,
  keepProcessAlive = false,
  stopOnPackageVersionChange = false,

  // this callback will be called each time a projectFile was
  // used to respond to a request
  // each time an execution needs a project file this callback
  // will be called.
  projectFileRequestedCallback = undefined,
  projectFilePredicate = () => true,

  // remaining options are complex or private
  compileGroupCount = 1,
  babelCompatMap = jsenvBabelPluginCompatMap,
  browserScoreMap = jsenvBrowserScoreMap,
  nodeVersionScoreMap = jsenvNodeVersionScoreMap,
  platformAlwaysInsidePlatformScoreMap = false,
  browserPlatformFileUrl = resolveFileUrl(
    "./src/internal/compiling/platform-service/createBrowserPlatform/index.js",
    jsenvCoreDirectoryUrl,
  ),
  nodePlatformFileUrl = resolveFileUrl(
    "./src/internal/compiling/platform-service/createNodePlatform/index.js",
    jsenvCoreDirectoryUrl,
  ),
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string. got ${projectDirectoryUrl}`)
  }
  if (typeof importMapFileUrl === "undefined") {
    importMapFileUrl = resolveFileUrl("./importMap.json", projectDirectoryUrl)
  }
  if (typeof compileDirectoryUrl !== "string") {
    throw new TypeError(`compileDirectoryUrl must be a string. got ${compileDirectoryUrl}`)
  }
  if (!compileDirectoryUrl.startsWith(projectDirectoryUrl)) {
    throw new TypeError(`compileDirectoryUrl must be inside projectDirectoryUrl.
--- compile directory url ---
${compileDirectoryUrl}
--- project directory url ---
${projectDirectoryUrl}`)
  }
  if (typeof browserPlatformFileUrl !== "string") {
    throw new TypeError(`browserPlatformFileUrl must be a string. got ${browserPlatformFileUrl}`)
  }
  if (!browserPlatformFileUrl.startsWith(projectDirectoryUrl)) {
    throw new TypeError(`browserPlatformFileUrl must be inside projectDirectoryUrl.
--- browser platform file url ---
${browserPlatformFileUrl}
--- project directory url ---
${projectDirectoryUrl}`)
  }
  if (typeof nodePlatformFileUrl !== "string") {
    throw new TypeError(`nodePlatformFileUrl must be a string. got ${nodePlatformFileUrl}`)
  }
  if (!nodePlatformFileUrl.startsWith(projectDirectoryUrl)) {
    throw new TypeError(`nodePlatformFileUrl must be inside projectDirectoryUrl.
--- node platform file url ---
${nodePlatformFileUrl}
--- project directory url ---
${projectDirectoryUrl}`)
  }

  const logger = createLogger({ logLevel })

  const groupMap = generateGroupMap({
    babelPluginMap,
    babelCompatMap,
    platformScoreMap: { ...browserScoreMap, node: nodeVersionScoreMap },
    groupCount: compileGroupCount,
    platformAlwaysInsidePlatformScoreMap,
  })

  const compileDirectoryMeta = {
    babelPluginMap,
    convertMap,
    groupMap,
  }
  await cleanCompileDirectoryIfObsolete({
    compileDirectoryUrl,
    compileDirectoryMeta,
    forceObsolete: compileDirectoryClean,
    cleanCallback: (compileDirectoryPath) => {
      logger.info(`clean compile directory content at ${compileDirectoryPath}`)
    },
  })

  const packageFileUrl = resolveFileUrl("./package.json", jsenvCoreDirectoryUrl)
  const packageFilePath = fileUrlToPath(packageFileUrl)
  const packageVersion = readPackage(packageFilePath).version

  if (projectFileRequestedCallback) {
    if (typeof projectFileRequestedCallback !== "function") {
      throw new TypeError(
        `projectFileRequestedCallback must be a function, got ${projectFileRequestedCallback}`,
      )
    }
    const originalProjectFileRequestedCallback = projectFileRequestedCallback
    projectFileRequestedCallback = ({ relativeUrl, ...rest }) => {
      // I doubt an asset like .js.map will change
      // in theory a compilation asset should not change
      // if the source file did not change
      // so we can avoid watching compilation asset
      if (urlIsAsset(`${projectDirectoryUrl}${relativeUrl}`)) {
        return
      }

      if (projectFilePredicate(relativeUrl)) {
        originalProjectFileRequestedCallback({ relativeUrl, ...rest })
      }
    }
  } else {
    projectFileRequestedCallback = () => {}
  }

  const compileServer = await startServer({
    cancellationToken,
    protocol,
    privateKey,
    certificate,
    ip,
    port,
    sendInternalErrorStack: true,
    requestToResponse: (request) =>
      firstService(
        () =>
          serveBrowserPlatform({
            logger,
            projectDirectoryUrl,
            compileDirectoryUrl,
            importMapFileUrl,
            importDefaultExtension,
            browserPlatformFileUrl,
            babelPluginMap,
            groupMap,
            projectFileRequestedCallback,
            request,
          }),
        () =>
          serveNodePlatform({
            logger,
            projectDirectoryUrl,
            compileDirectoryUrl,
            importMapFileUrl,
            importDefaultExtension,
            nodePlatformFileUrl,
            babelPluginMap,
            groupMap,
            projectFileRequestedCallback,
            request,
          }),
        () =>
          serveCompiledJs({
            projectDirectoryUrl,
            compileDirectoryUrl,
            writeOnFilesystem,
            useFilesystemAsCache,
            groupMap,
            babelPluginMap,
            convertMap,
            transformTopLevelAwait,
            transformModuleIntoSystemFormat,
            projectFileRequestedCallback,
            request,
          }),
        () =>
          serveProjectFiles({
            projectDirectoryUrl,
            projectFileRequestedCallback,
            request,
          }),
      ),
    logLevel,
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

  if (stopOnPackageVersionChange) {
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
    })
    compileServer.stoppedPromise.then(
      () => {
        unregister()
      },
      () => {},
    )
  }

  return compileServer
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

const serveProjectFiles = ({ projectDirectoryUrl, projectFileRequestedCallback, request }) => {
  const { ressource, method, headers } = request
  const relativeUrl = ressource.slice(1)

  projectFileRequestedCallback({
    relativeUrl,
    request,
  })

  const fileUrl = resolveFileUrl(ressource.slice(1), projectDirectoryUrl)
  const filePath = fileUrlToPath(fileUrl)

  return serveFile(filePath, {
    method,
    headers,
  })
}
