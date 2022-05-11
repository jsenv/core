/*
 * startBuildServer is mean to interact with the build files;
 * files that will be deployed to production server(s).
 * We want to be as close as possible from the production in order to:
 * - run lighthouse
 * - run an automated test tool such as cypress, playwright
 * - see exactly how build file behaves (debug, measure perf, etc)
 * For these reasons "startBuildServer" must be as close as possible from a static file server.
 * It is not meant to provide a nice developper experience: this is the role "startDevServer".
 *
 * Conclusion:
 * "startBuildServer" must be as close as possible from a static file server because
 * we want to be in the user shoes and we should not alter build files.
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
import { watchFiles } from "@jsenv/utils/file_watcher/file_watcher.js"
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
  sourcemaps,
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
  watchedFilePatterns,
  cooldownBetweenFileEvents,

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

  let buildPromise
  let abortController
  const runBuild = () => {
    abortController = new AbortController()
    operation.addAbortCallback(() => {
      abortController.abort()
    })
    buildPromise = build({
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
    requestToResponse: async (request) => {
      await buildPromise
      const urlIsVersioned =
        versioningMethod === "search_param"
          ? new URL(request.ressource, request.origin).searchParams.has("v")
          : // we could use a regex, but there can be false-positive
            false

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

  const unregisterDirectoryLifecyle = watchFiles({
    rootDirectoryUrl,
    watchedFilePatterns,
    cooldownBetweenFileEvents,
    fileChangeCallback: () => {
      abortController.abort()
      runBuild()
    },
  })
  operation.addAbortCallback(() => {
    unregisterDirectoryLifecyle()
  })
  runBuild()

  return server
}

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30
