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
  pluginServerTiming,
  pluginRequestWaitingCheck,
  pluginCORS,
  fetchFileSystem,
  composeServices,
} from "@jsenv/server"
import {
  assertAndNormalizeDirectoryUrl,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem"
import { createLogger, loggerToLevels } from "@jsenv/logger"

import { createTaskLog } from "@jsenv/log"
import { getCallerPosition } from "@jsenv/urls"
import { initReloadableProcess } from "@jsenv/utils/process_reload/process_reload.js"

export const startBuildServer = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel,
  serverLogLevel = "warn",
  protocol = "http",
  http2,
  certificate,
  privateKey,
  listenAnyIp,
  ip,
  port = 9779,
  services = {},

  rootDirectoryUrl,
  buildDirectoryUrl,
  mainBuildFileUrl = "/index.html",
  buildServerFiles = {
    "./package.json": true,
    "./jsenv.config.mjs": true,
  },
  buildServerMainFile = getCallerPosition().url,
  // force disable server autoreload when this code is executed:
  // - inside a forked child process
  // - inside a worker thread
  // (because node cluster won't work)
  buildServerAutoreload = typeof process.send !== "function" &&
    !parentPort &&
    !process.debugPort,
  cooldownBetweenFileEvents,
}) => {
  const logger = createLogger({ logLevel })
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl)

  const reloadableProcess = await initReloadableProcess({
    signal,
    handleSIGINT,
    ...(buildServerAutoreload
      ? {
          enabled: true,
          logLevel: "info",
          fileToRestart: buildServerMainFile,
        }
      : {
          enabled: false,
        }),
  })
  if (reloadableProcess.isPrimary) {
    const buildServerFileChangeCallback = ({ relativeUrl, event }) => {
      const url = new URL(relativeUrl, rootDirectoryUrl).href
      if (buildServerAutoreload) {
        logger.info(`file ${event} ${url} -> restarting server...`)
        reloadableProcess.reload()
      }
    }
    const stopWatchingBuildServerFiles = registerDirectoryLifecycle(
      rootDirectoryUrl,
      {
        watchPatterns: {
          [buildServerMainFile]: true,
          ...buildServerFiles,
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
    signal.addEventListener("abort", () => {
      stopWatchingBuildServerFiles()
    })
    return {
      origin: `${protocol}://127.0.0.1:${port}`,
      stop: () => {
        stopWatchingBuildServerFiles()

        reloadableProcess.stop()
      },
    }
  }
  signal = reloadableProcess.signal

  const startBuildServerTask = createTaskLog("start build server", {
    disabled: !loggerToLevels(logger).info,
  })
  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: false,
    stopOnInternalError: false,
    keepProcessAlive: true,
    logLevel: serverLogLevel,
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
        accessControlAllowedRequestHeaders: jsenvAccessControlAllowedHeaders,
        accessControlAllowCredentials: true,
      }),
      ...pluginServerTiming(),
      ...pluginRequestWaitingCheck({
        requestWaitingMs: 60 * 1000,
      }),
    },
    sendErrorDetails: true,
    requestToResponse: composeServices({
      ...services,
      build_files_service: createBuildFilesService({
        buildDirectoryUrl,
        mainBuildFileUrl,
      }),
    }),
  })
  startBuildServerTask.done()
  logger.info(``)
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`)
  })
  logger.info(``)

  return {
    origin: server.origin,
    stop: () => {
      server.stop()
    },
  }
}

const createBuildFilesService = ({ buildDirectoryUrl, mainBuildFileUrl }) => {
  return (request) => {
    const urlIsVersioned = new URL(
      request.ressource,
      request.origin,
    ).searchParams.has("v")
    if (mainBuildFileUrl && request.ressource === "/") {
      request = {
        ...request,
        ressource: mainBuildFileUrl,
      }
    }
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
  }
}

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30
