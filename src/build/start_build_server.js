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
import { executeCommand } from "@jsenv/utils/command/command.js"

export const startBuildServer = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel,
  buildCommandLogLevel = "warn",
  protocol,
  http2,
  certificate,
  privateKey,
  listenAnyIp,
  ip,
  port,

  rootDirectoryUrl,
  buildDirectoryUrl,
  buildCommand,
  watchedFilePatterns,
  cooldownBetweenFileEvents,
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
  const logger = createLogger({ logLevel })

  let buildPromise
  let abortController
  const runBuild = async () => {
    const buildTask = createTaskLog(logger, `execute build command`)
    abortController = new AbortController()
    operation.addAbortCallback(() => {
      abortController.abort()
    })
    buildPromise = executeCommand(buildCommand, {
      cwd: rootDirectoryUrl,
      logLevel: buildCommandLogLevel,
      signal: abortController.signal,
    })
    try {
      await buildPromise
      buildTask.done()
    } catch (e) {
      if (e.code === "ABORT_ERR") {
        buildTask.fail(`execute build command aborted`)
      } else {
        buildTask.fail()
        throw e
      }
    }
  }

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

  const unregisterDirectoryLifecyle = watchFiles({
    rootDirectoryUrl,
    watchedFilePatterns,
    cooldownBetweenFileEvents,
    fileChangeCallback: ({ relativeUrl, event }) => {
      abortController.abort()
      // setTimeout is to ensure the abortController.abort() above
      // is properly taken into account so that logs about abort comes first
      // then logs about re-running the build happens
      setTimeout(() => {
        logger.info(`${relativeUrl} ${event} -> rebuild`)
        runBuild()
      })
    },
  })
  operation.addAbortCallback(() => {
    unregisterDirectoryLifecyle()
  })
  runBuild()

  return server
}

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30
