import {
  assertAndNormalizeDirectoryUrl,
  lookupPackageDirectory,
} from "@jsenv/filesystem";
import { createLogger, createTaskLog } from "@jsenv/humanize";
import {
  jsenvAccessControlAllowedHeaders,
  serverPluginCORS,
  startServer,
} from "@jsenv/server";
import { urlIsOrIsInsideOf, urlToRelativeUrl } from "@jsenv/urls";
import { existsSync } from "node:fs";

import { defaultRuntimeCompat } from "../build/build_params.js";
import { createEventEmitter } from "../helpers/event_emitter.js";
import { jsenvCoreDirectoryUrl } from "../jsenv_core_directory_url.js";
import { createPackageDirectory } from "../kitchen/package_directory.js";
import { createJsenvPluginStore } from "../plugins/jsenv_plugins_controller.js";
import { getCorePlugins } from "../plugins/plugins.js";
import { jsenvPluginServerEvents } from "../plugins/server_events/jsenv_plugin_server_events.js";
import { devServerPluginChromeDevToolsJson } from "./dev_server_plugins/dev_server_plugin_chrome_devtools_json.js";
import { devServerPluginInjectServerResponseHeader } from "./dev_server_plugins/dev_server_plugin_inject_server_response_header.js";
import { devServerPluginOmegaErrorHandler } from "./dev_server_plugins/dev_server_plugin_omega_error_handler.js";
import { devServerPluginServeSourceFiles } from "./dev_server_plugins/dev_server_plugin_serve_source_files.js";

const EXECUTED_BY_TEST_PLAN = process.argv.includes("--jsenv-test");

/**
 * Starts the development server.
 *
 * @param {Object} [params={}] - Configuration params for the dev server.
 * @param {number} [params.port=3456] - Port number the server should listen on.
 * @param {string} [params.hostname="localhost"] - Hostname to bind the server to.
 * @param {boolean} [params.https=false] - Whether to use HTTPS.
 *
 * @returns {Promise<Object>} A promise that resolves to the server instance.
 * @throws {Error} Will throw an error if the server fails to start or is called with unexpected params.
 *
 * @example
 * // Start a basic dev server
 * const server = await startDevServer();
 * console.log(`Server started at ${server.origin}`);
 *
 * @example
 * // Start a server with custom params
 * const server = await startDevServer({
 *   port: 8080,
 * });
 */
export const startDevServer = async ({
  sourceDirectoryUrl,
  sourceMainFilePath = "./index.html",
  ignore,
  port = 3456,
  hostname,
  acceptAnyIp,
  https,
  // it's better to use http1 by default because it allows to get statusText in devtools
  // which gives valuable information when there is errors
  http2 = false,
  logLevel = EXECUTED_BY_TEST_PLAN ? "warn" : "info",
  serverLogLevel = "warn",
  serverRouterLogLevel = "warn",
  serverPlugins = [],

  signal = new AbortController().signal,
  handleSIGINT = true,
  keepProcessAlive = true,
  onStop = () => {},

  sourceFilesConfig = {},
  clientAutoreload = true,
  clientAutoreloadOnServerRestart = true,

  // runtimeCompat is the runtimeCompat for the build
  // when specified, dev server use it to warn in case
  // code would be supported during dev but not after build
  runtimeCompat = defaultRuntimeCompat,
  plugins = [],
  referenceAnalysis = {},
  nodeEsmResolution,
  packageConditions,
  packageConditionsConfig,
  supervisor = true,
  magicExtensions,
  magicDirectoryIndex,
  directoryListing,
  injections,
  transpilation,
  cacheControl = true,
  ribbon = true,
  dropToOpen = true,
  // toolbar = false,
  onKitchenCreated = () => {},
  spa,
  packageBundle,

  sourcemaps = "inline",
  sourcemapsSourcesContent,
  outDirectoryUrl,
  ...rest
}) => {
  // params type checking
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(
      sourceDirectoryUrl,
      "sourceDirectoryUrl",
    );
    if (!existsSync(new URL(sourceDirectoryUrl))) {
      throw new Error(`ENOENT on sourceDirectoryUrl at ${sourceDirectoryUrl}`);
    }
    if (typeof sourceMainFilePath !== "string") {
      throw new TypeError(
        `sourceMainFilePath must be a string, got ${sourceMainFilePath}`,
      );
    }
    sourceMainFilePath = urlToRelativeUrl(
      new URL(sourceMainFilePath, sourceDirectoryUrl),
      sourceDirectoryUrl,
    );
    if (outDirectoryUrl === undefined) {
      if (
        process.env.CAPTURING_SIDE_EFFECTS ||
        (!import.meta.build &&
          urlIsOrIsInsideOf(sourceDirectoryUrl, jsenvCoreDirectoryUrl))
      ) {
        outDirectoryUrl = new URL("../.jsenv/", sourceDirectoryUrl);
      } else {
        const packageDirectoryUrl = lookupPackageDirectory(sourceDirectoryUrl);
        if (packageDirectoryUrl) {
          outDirectoryUrl = `${packageDirectoryUrl}.jsenv/`;
        }
      }
    } else if (outDirectoryUrl !== null && outDirectoryUrl !== false) {
      outDirectoryUrl = assertAndNormalizeDirectoryUrl(
        outDirectoryUrl,
        "outDirectoryUrl",
      );
    }
  }
  // params normalization
  {
    if (clientAutoreload === true) {
      clientAutoreload = {};
    }
    if (clientAutoreload === false) {
      clientAutoreload = { enabled: false };
    }
  }

  const logger = createLogger({ logLevel });
  const startDevServerTask = createTaskLog("start dev server", {
    disabled: !logger.levels.info,
  });

  const serverStopCallbackSet = new Set();
  const serverStopAbortController = new AbortController();
  serverStopCallbackSet.add(() => {
    serverStopAbortController.abort();
  });
  const serverStopAbortSignal = serverStopAbortController.signal;

  const kitchenCache = new Map();
  const packageDirectory = createPackageDirectory({ sourceDirectoryUrl });
  const clientFileChangeEventEmitter = createEventEmitter();
  const clientFileDereferencedEventEmitter = createEventEmitter();
  clientAutoreload = {
    enabled: true,
    clientServerEventsConfig: {},
    clientFileChangeEventEmitter,
    clientFileDereferencedEventEmitter,
    ...clientAutoreload,
  };

  const devServerJsenvPluginStore = await createJsenvPluginStore([
    jsenvPluginServerEvents({ clientAutoreload }),
    ...plugins,
    ...getCorePlugins({
      packageDirectory,
      rootDirectoryUrl: sourceDirectoryUrl,
      mainFilePath: sourceMainFilePath,
      runtimeCompat,
      sourceFilesConfig,

      referenceAnalysis,
      nodeEsmResolution,
      packageConditions,
      packageConditionsConfig,
      magicExtensions,
      magicDirectoryIndex,
      directoryListing,
      supervisor,
      injections,
      transpilation,
      spa,
      packageBundle,

      clientAutoreload,
      clientAutoreloadOnServerRestart,
      cacheControl,
      ribbon,
      dropToOpen,
    }),
  ]);

  const finalServerPlugins = [];
  finalServerPlugins.push(
    // "header" service
    devServerPluginInjectServerResponseHeader({ sourceDirectoryUrl }),
    // cors service
    serverPluginCORS({
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowedRequestHeaders: [
        ...jsenvAccessControlAllowedHeaders,
        "x-jsenv-execution-id",
      ],
      accessControlAllowCredentials: true,
      timingAllowOrigin: true,
    }),
    // chrome devtools
    devServerPluginChromeDevToolsJson({ sourceDirectoryUrl }),
    ...serverPlugins,
    devServerPluginServeSourceFiles({
      packageDirectory,
      sourceDirectoryUrl,
      sourceMainFilePath,
      ignore,
      sourceFilesConfig,
      clientAutoreload,

      logLevel,
      runtimeCompat,
      onKitchenCreated,

      supervisor,
      sourcemaps,
      sourcemapsSourcesContent,
      outDirectoryUrl,

      serverStopAbortSignal,
      serverStopCallbackSet,
      devServerJsenvPluginStore,
      kitchenCache,
    }),
    // jsenv error handler service
    devServerPluginOmegaErrorHandler(),
  );

  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: handleSIGINT,
    stopOnInternalError: false,
    keepProcessAlive,
    logLevel: serverLogLevel,
    routerLogLevel: serverRouterLogLevel,
    startLog: false,

    https,
    http2,
    acceptAnyIp,
    hostname,
    port,
    requestWaitingMs: 60_000,
    plugins: finalServerPlugins,
    // will allow to open file, provide more context on each route
    canExposeSensitiveData: true,
  });
  server.stoppedPromise.then((reason) => {
    onStop();
    for (const serverStopCallback of serverStopCallbackSet) {
      serverStopCallback(reason);
    }
    serverStopCallbackSet.clear();
  });
  startDevServerTask.done();
  if (hostname) {
    delete server.origins.localip;
    delete server.origins.externalip;
  }
  logger.info(``);
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`);
  });
  logger.info(``);
  return {
    origin: server.origin,
    sourceDirectoryUrl,
    stop: () => {
      server.stop();
    },
    kitchenCache,
  };
};
