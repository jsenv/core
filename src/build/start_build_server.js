/*
 * TODO: inject an event source client to autoreload
 * when a file changes
 *
 */

import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  pluginServerTiming,
  pluginRequestWaitingCheck,
  pluginCORS,
  fetchFileSystem,
} from "@jsenv/server"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"
import { createLogger } from "@jsenv/logger"

import { createTaskLog } from "@jsenv/utils/logs/task_log.js"
// import { watchFiles } from "@jsenv/utils/file_watcher/file_watcher.js"
import { build } from "../build/build.js"

export const startBuildServer = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel,
  protocol,
  http2,
  certificate,
  privateKey,
  listenAnyIp,
  ip,
  port,

  rootDirectoryUrl,
  buildDirectoryUrl,
  entryPoints,

  plugins,
  sourcemaps = "file",
  nodeEsmResolution,
  fileSystemMagicResolution,
  injectedGlobals,
  runtimeCompat,
  transpilation,
  bundling,
  minification,
  versioning,
  versioningMethod = "search_param", // "filename", "search_param"
  lineBreakNormalization,
  autoreload = true,

  baseUrl,
}) => {
  const operation = Abort.startOperation()
  operation.addAbortSignal(signal)
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      )
    })
  }

  let abortController
  const runBuild = async () => {
    abortController = new AbortController()
    operation.addAbortCallback(() => {
      abortController.abort()
    })
    await build({
      signal: abortController.signal,
      logLevel: "warn",
      rootDirectoryUrl,
      buildDirectoryUrl,
      entryPoints,

      plugins,
      sourcemaps,
      nodeEsmResolution,
      fileSystemMagicResolution,
      injectedGlobals,
      runtimeCompat,
      transpilation,
      bundling,
      minification,
      versioning,
      versioningMethod,
      lineBreakNormalization,
      autoreload,

      writeOnFileSystem: true,
      buildDirectoryClean: true,
      baseUrl,
      assetManifest: false,
    })
  }

  const logger = createLogger({ logLevel })
  const startServerTask = createTaskLog(logger, "start build server")
  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: false,
    stopOnInternalError: false,
    keepProcessAlive: true,
    logLevel,
    startLog: false,

    protocol,
    http2,
    certificate,
    privateKey,
    listenAnyIp,
    ip,
    port,
    plugins: {
      ...pluginCORS({
        accessControlAllowRequestOrigin: true,
        accessControlAllowRequestMethod: true,
        accessControlAllowRequestHeaders: true,
        accessControlAllowedRequestHeaders: [
          ...jsenvAccessControlAllowedHeaders,
          "x-jsenv-execution-id",
        ],
        accessControlAllowCredentials: true,
      }),
      ...pluginServerTiming(),
      ...pluginRequestWaitingCheck({
        requestWaitingMs: 60 * 1000,
      }),
    },
    sendErrorDetails: true,
    requestToResponse: (request) => {
      const urlIsVersioned = new URL(
        request.ressource,
        request.origin,
      ).searchParams.has("v")

      return fetchFileSystem(
        new URL(request.ressource.slice(1), buildDirectoryUrl),
        {
          headers: request.headers,
          cacheControl: urlIsVersioned
            ? `private,max-age=${SECONDS_IN_30_DAYS},immutable`
            : "private,max-age=0,must-revalidate",
          etagEnabled: true,
          compressionEnabled: !request.pathname.endsWith(".mp4"),
          rootDirectoryUrl: buildDirectoryUrl,
          canReadDirectory: true,
        },
      )
    },
  })
  startServerTask.done()
  logger.info(``)
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`)
  })
  logger.info(``)

  // const unregisterDirectoryLifecyle = watchFiles({
  //   rootDirectoryUrl,
  //   patterns: {
  //     ...autoreloadPatterns,
  //     ".jsenv/": false,
  //   },
  //   cooldownBetweenFileEvents,
  //   fileChangeCallback: () => {
  //     abortController.abort()
  //     runBuild()
  //     // this is where we would like to tell browser to reload
  //   },
  // })
  // operation.addAbortCallback(() => {
  //   unregisterDirectoryLifecyle()
  // })
  runBuild()

  return server
}

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30
