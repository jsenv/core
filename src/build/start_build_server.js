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

import { parentPort } from "node:worker_threads"
import {
  jsenvAccessControlAllowedHeaders,
  startServer,
  fetchFileSystem,
  jsenvServiceCORS,
  jsenvServiceErrorHandler,
} from "@jsenv/server"
import {
  assertAndNormalizeDirectoryUrl,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"
import { createLogger, loggerToLevels, createTaskLog } from "@jsenv/log"
import { getCallerPosition } from "@jsenv/urls"

import { createReloadableWorker } from "@jsenv/core/src/helpers/worker_reload.js"

export const startBuildServer = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel,
  serverLogLevel = "warn",
  protocol = "http",
  http2,
  certificate,
  privateKey,
  acceptAnyIp,
  hostname,
  port = 9779,
  services = [],
  keepProcessAlive = true,

  rootDirectoryUrl,
  buildDirectoryUrl,
  buildIndexPath = "/index.html",
  buildServerFiles = {
    "./package.json": true,
    "./jsenv.config.mjs": true,
  },
  buildServerAutoreload = false,
  buildServerMainFile = getCallerPosition().url,
  cooldownBetweenFileEvents,
}) => {
  const logger = createLogger({ logLevel })
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl)
  if (buildIndexPath) {
    if (typeof buildIndexPath !== "string") {
      throw new TypeError(
        `buildIndexPath must be a string, got ${buildIndexPath}`,
      )
    }
    if (buildIndexPath[0] === "/") {
      buildIndexPath = buildIndexPath.slice(1)
    } else {
      const buildIndexUrl = new URL(buildIndexPath, buildDirectoryUrl).href
      if (!buildIndexUrl.startsWith(buildDirectoryUrl)) {
        throw new Error(
          `buildIndexPath must be relative, got ${buildIndexPath}`,
        )
      }
      buildIndexPath = buildIndexUrl.slice(buildDirectoryUrl.length)
    }
  }

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

  let reloadableWorker
  if (buildServerAutoreload) {
    reloadableWorker = createReloadableWorker(buildServerMainFile)
    if (reloadableWorker.isPrimary) {
      const buildServerFileChangeCallback = ({ relativeUrl, event }) => {
        const url = new URL(relativeUrl, rootDirectoryUrl).href
        logger.info(`file ${event} ${url} -> restarting server...`)
        reloadableWorker.reload()
      }
      const stopWatchingBuildServerFiles = registerDirectoryLifecycle(
        rootDirectoryUrl,
        {
          watchPatterns: {
            ...buildServerFiles,
            [buildServerMainFile]: true,
            ".jsenv/": false,
          },
          cooldownBetweenFileEvents,
          keepProcessAlive: false,
          recursive: true,
          added: ({ relativeUrl }) => {
            buildServerFileChangeCallback({ relativeUrl, event: "added" })
          },
          updated: ({ relativeUrl }) => {
            buildServerFileChangeCallback({ relativeUrl, event: "modified" })
          },
          removed: ({ relativeUrl }) => {
            buildServerFileChangeCallback({ relativeUrl, event: "removed" })
          },
        },
      )
      operation.addAbortCallback(() => {
        stopWatchingBuildServerFiles()
        reloadableWorker.terminate()
      })
      const worker = await reloadableWorker.load()
      const messagePromise = new Promise((resolve) => {
        worker.once("message", resolve)
      })
      const origin = await messagePromise
      // if (!keepProcessAlive) {
      //   worker.unref()
      // }
      return {
        origin,
        stop: () => {
          stopWatchingBuildServerFiles()
          reloadableWorker.terminate()
        },
      }
    }
  }

  const startBuildServerTask = createTaskLog("start build server", {
    disabled: !loggerToLevels(logger).info,
  })
  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: false,
    stopOnInternalError: false,
    // the worker should be kept alive by the parent otherwise
    keepProcessAlive,
    logLevel: serverLogLevel,
    startLog: false,

    protocol,
    http2,
    certificate,
    privateKey,
    acceptAnyIp,
    hostname,
    port,
    serverTiming: true,
    requestWaitingMs: 60_000,
    services: [
      jsenvServiceCORS({
        accessControlAllowRequestOrigin: true,
        accessControlAllowRequestMethod: true,
        accessControlAllowRequestHeaders: true,
        accessControlAllowedRequestHeaders: jsenvAccessControlAllowedHeaders,
        accessControlAllowCredentials: true,
        timingAllowOrigin: true,
      }),
      ...services,
      {
        name: "jsenv:build_files_service",
        handleRequest: createBuildFilesService({
          buildDirectoryUrl,
          buildIndexPath,
        }),
      },
      jsenvServiceErrorHandler({
        sendErrorDetails: true,
      }),
    ],
  })
  startBuildServerTask.done()
  logger.info(``)
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`)
  })
  logger.info(``)
  if (reloadableWorker && reloadableWorker.isWorker) {
    parentPort.postMessage(server.origin)
  }
  return {
    origin: server.origin,
    stop: () => {
      server.stop()
    },
  }
}

const createBuildFilesService = ({ buildDirectoryUrl, buildIndexPath }) => {
  return (request) => {
    const urlIsVersioned = new URL(request.url).searchParams.has("v")
    if (buildIndexPath && request.resource === "/") {
      request = {
        ...request,
        resource: `/${buildIndexPath}`,
      }
    }
    return fetchFileSystem(
      new URL(request.resource.slice(1), buildDirectoryUrl),
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
  }
}

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30
