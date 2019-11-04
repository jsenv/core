/* eslint-disable import/max-dependencies */
import { readFileSync } from "fs"
import { createCancellationToken } from "@dmail/cancellation"
import { registerFileLifecycle } from "@dmail/filesystem-watch"
import { createLogger } from "@jsenv/logger"
import { generateGroupMap } from "./private/generateGroupMap/generateGroupMap.js"
import { resolveFileUrl, fileUrlToPath } from "./private/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "./private/jsenvCoreDirectoryUrl.js"
import { serveBrowserPlatform } from "./private/compile-server/serveBrowserPlatform.js"
import { serveNodePlatform } from "./private/compile-server/serveNodePlatform.js"
import { serveCompiledJs, relativePathIsAsset } from "./private/compile-server/serveCompiledJs.js"
import { cleanCompileDirectoryIfObsolete } from "./private/compile-server/compile-directory/cleanCompileDirectoryIfObsolete.js"
import { jsenvBabelPluginCompatMap } from "./jsenvBabelPluginCompatMap.js"
import { jsenvBrowserScoreMap } from "./jsenvBrowserScoreMap.js"
import { jsenvNodeVersionScoreMap } from "./jsenvNodeVersionScoreMap.js"

const {
  defaultAccessControlAllowedHeaders,
  startServer,
  firstService,
  serveFile,
} = import.meta.require("@dmail/server")
const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

export const startCompileServer = async ({
  cancellationToken = createCancellationToken(),
  logLevel,

  // js compile options
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,

  projectDirectoryUrl,
  compileDirectoryUrl,
  compileDirectoryClean = false,
  importMapFileRelativePath = "./importMap.json",
  importDefaultExtension,
  babelPluginMap = jsenvBabelPluginMap,
  convertMap = {},

  // options related to the server itself
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  signature,
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
    "./src/private/compile-server/platform-service/createBrowserPlatform/index.js",
    jsenvCoreDirectoryUrl,
  ),
  nodePlatformFileUrl = resolveFileUrl(
    "./src/private/compile-server/platform-service/createNodePlatform/index.js",
    jsenvCoreDirectoryUrl,
  ),
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string. got ${projectDirectoryUrl}`)
  }
  if (typeof browserPlatformFileUrl !== "string") {
    throw new TypeError(`browserPlatformFileUrl must be a string. got ${browserPlatformFileUrl}`)
  }
  if (typeof nodePlatformFileUrl !== "string") {
    throw new TypeError(`nodePlatformFileUrl must be a string. got ${nodePlatformFileUrl}`)
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
      logger.warn(`remove compile directory ${compileDirectoryPath}`)
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
    projectFileRequestedCallback = ({ relativePath, ...rest }) => {
      // I doubt an asset like .js.map will change
      // in theory a compilation asset should not change
      // if the source file did not change
      // so we can avoid watching compilation asset
      if (relativePathIsAsset(relativePath)) return

      if (projectFilePredicate(relativePath)) {
        originalProjectFileRequestedCallback({ relativePath, ...rest })
      }
    }
  } else {
    projectFileRequestedCallback = () => {}
  }

  const compileServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    signature,
    sendInternalErrorStack: true,
    requestToResponse: (request) =>
      firstService(
        () =>
          serveBrowserPlatform({
            logger,
            projectDirectoryUrl,
            compileDirectoryUrl,
            importMapFileRelativePath,
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
            importMapFileRelativePath,
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
      ...defaultAccessControlAllowedHeaders,
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
  const relativePath = ressource.slice(1)

  if (!relativePathIsAsset(relativePath)) {
    projectFileRequestedCallback({
      relativePath,
      request,
    })
  }

  const fileUrl = resolveFileUrl(ressource.slice(1), projectDirectoryUrl)
  const filePath = fileUrlToPath(fileUrl)

  return serveFile(filePath, {
    method,
    headers,
  })
}
