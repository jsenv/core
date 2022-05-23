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
import {
  assertAndNormalizeDirectoryUrl,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"
import { Abort } from "@jsenv/abort"

import { initReloadableProcess } from "@jsenv/utils/process_reload/process_reload.js"
import { createTaskLog } from "@jsenv/utils/logs/task_log.js"
import { executeCommand } from "@jsenv/utils/command/command.js"

export const startBuildServer = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel,
  buildCommandLogLevel = "warn",
  protocol = "http",
  http2,
  certificate,
  privateKey,
  listenAnyIp,
  ip,
  port = 9779,

  rootDirectoryUrl,
  buildDirectoryUrl,
  buildServerFiles = {
    "./package.json": true,
    "./jsenv.config.mjs": true,
  },
  buildServerMainFile,
  buildServerAutoreload = false,
  clientFiles = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git,.jsenv for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
  cooldownBetweenFileEvents,
  buildCommand,
  mainBuildFileUrl = "/index.html",
  autorestart,
}) => {
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl)

  const reloadableProcess = await initReloadableProcess({
    handleSIGINT,
    ...(autorestart
      ? {
          enabled: true,
          logLevel: autorestart.logLevel,
          fileToRestart: autorestart.file,
        }
      : {
          enabled: false,
        }),
  })
  const buildServerFileChangeCallbackList = []
  const clientFileChangeCallbackList = []
  if (reloadableProcess.isPrimary) {
    const buildServerFileChangeCallback = ({ relativeUrl, event }) => {
      const url = new URL(relativeUrl, rootDirectoryUrl).href
      buildServerFileChangeCallbackList.forEach((callback) => {
        callback({ url, event })
      })
    }
    const unregisterBuildServerFilesWatcher = registerDirectoryLifecycle(
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

    const clientFileChangeCallback = ({ relativeUrl, event }) => {
      const url = new URL(relativeUrl, rootDirectoryUrl).href
      clientFileChangeCallbackList.forEach((callback) => {
        callback({ url, event })
      })
    }
    const unregisterClientFilesWatcher = registerDirectoryLifecycle(
      rootDirectoryUrl,
      {
        watchPatterns: clientFiles,
        cooldownBetweenFileEvents,
        keepProcessAlive: false,
        recursive: true,
        added: ({ relativeUrl }) => {
          clientFileChangeCallback({ event: "added", relativeUrl })
        },
        updated: ({ relativeUrl }) => {
          clientFileChangeCallback({ event: "modified", relativeUrl })
        },
        removed: ({ relativeUrl }) => {
          clientFileChangeCallback({ event: "removed", relativeUrl })
        },
      },
    )
    signal.addEventListener("abort", () => {
      unregisterBuildServerFilesWatcher()
      unregisterClientFilesWatcher()
    })

    return {
      origin: `${protocol}://127.0.0.1:${port}`,
      stop: () => {
        unregisterBuildServerFilesWatcher()
        unregisterClientFilesWatcher()
        reloadableProcess.stop()
      },
    }
  }
  signal = reloadableProcess.signal
  const logger = createLogger({ logLevel })

  if (buildServerAutoreload) {
    buildServerFileChangeCallbackList.push(({ url, event }) => {
      logger.info(`file ${event} ${url} -> restarting server...`)
      reloadableProcess.reload()
    })
  }

  let buildPromise
  let buildAbortController
  const runBuild = async () => {
    buildAbortController = new AbortController()
    const buildOperation = Abort.startOperation()
    buildOperation.addAbortSignal(signal)
    buildOperation.addAbortSignal(buildAbortController.signal)
    const buildTask = createTaskLog(logger, `execute build command`)
    buildPromise = executeCommand(buildCommand, {
      cwd: rootDirectoryUrl,
      logLevel: buildCommandLogLevel,
      signal: buildOperation.signal,
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
    },
  })
  startServerTask.done()
  logger.info(``)
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`)
  })
  logger.info(``)

  runBuild()
  clientFileChangeCallbackList.push(({ url, event }) => {
    buildAbortController.abort()
    // setTimeout is to ensure the abortController.abort() above
    // is properly taken into account so that logs about abort comes first
    // then logs about re-running the build happens
    setTimeout(() => {
      logger.info(`${url.slice(rootDirectoryUrl.length)} ${event} -> rebuild`)
      runBuild()
    })
  })
  return {
    origin: server.origin,
    stop: () => server.stop(),
  }
}

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30
