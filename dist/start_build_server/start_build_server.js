import { startServer, serverPluginCORS, jsenvAccessControlAllowedHeaders, serverPluginStaticFiles, serverPluginErrorHandler } from "@jsenv/server";
import { existsSync } from "node:fs";
import { assertAndNormalizeDirectoryUrl, createLogger, Abort, raceProcessTeardownEvents, createTaskLog } from "./jsenv_core_packages.js";
import "./jsenv_core_node_modules.js";
import "node:process";
import "node:os";
import "node:tty";
import "node:util";
import "node:url";

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


/**
 * Start a server for build files.
 * @param {Object} buildServerParameters
 * @param {string|url} buildServerParameters.buildDirectoryUrl Directory where build files are written
 * @return {Object} A build server object
 */
const startBuildServer = async ({
  buildDirectoryUrl,
  buildDirectoryMainFileRelativeUrl = "index.html",
  port = 9779,
  routes,
  serverPlugins = [],
  acceptAnyIp,
  hostname,
  https,
  http2,
  logLevel,
  serverLogLevel = "warn",

  signal = new AbortController().signal,
  handleSIGINT = true,
  keepProcessAlive = true,

  ...rest
}) => {
  // params validation
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    buildDirectoryUrl = assertAndNormalizeDirectoryUrl(
      buildDirectoryUrl,
      "buildDirectoryUrl",
    );

    if (buildDirectoryMainFileRelativeUrl) {
      if (typeof buildDirectoryMainFileRelativeUrl !== "string") {
        throw new TypeError(
          `buildDirectoryMainFileRelativeUrl must be a string, got ${buildDirectoryMainFileRelativeUrl}`,
        );
      }
      if (buildDirectoryMainFileRelativeUrl[0] === "/") {
        buildDirectoryMainFileRelativeUrl =
          buildDirectoryMainFileRelativeUrl.slice(1);
      } else {
        const buildMainFileUrl = new URL(
          buildDirectoryMainFileRelativeUrl,
          buildDirectoryUrl,
        ).href;
        if (!buildMainFileUrl.startsWith(buildDirectoryUrl)) {
          throw new Error(
            `buildDirectoryMainFileRelativeUrl must be relative, got ${buildDirectoryMainFileRelativeUrl}`,
          );
        }
        buildDirectoryMainFileRelativeUrl = buildMainFileUrl.slice(
          buildDirectoryUrl.length,
        );
      }
      if (
        !existsSync(
          new URL(buildDirectoryMainFileRelativeUrl, buildDirectoryUrl),
        )
      ) {
        buildDirectoryMainFileRelativeUrl = null;
      }
    }
  }

  const logger = createLogger({ logLevel });
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          },
        abort,
      );
    });
  }

  const startBuildServerTask = createTaskLog("start build server", {
    disabled: !logger.levels.info,
  });
  const server = await startServer({
    signal,
    stopOnExit: false,
    stopOnSIGINT: false,
    stopOnInternalError: false,
    keepProcessAlive,
    logLevel: serverLogLevel,
    startLog: false,

    https,
    http2,
    acceptAnyIp,
    hostname,
    port,
    serverTiming: true,
    requestWaitingMs: 60_000,
    routes,
    plugins: [
      serverPluginCORS({
        accessControlAllowRequestOrigin: true,
        accessControlAllowRequestMethod: true,
        accessControlAllowRequestHeaders: true,
        accessControlAllowedRequestHeaders: jsenvAccessControlAllowedHeaders,
        accessControlAllowCredentials: true,
        timingAllowOrigin: true,
      }),
      ...serverPlugins,
      serverPluginStaticFiles({
        serverRelativeUrl: "/",
        directoryUrl: buildDirectoryUrl,
        directoryMainFileRelativeUrl: buildDirectoryMainFileRelativeUrl,
      }),
      serverPluginErrorHandler({
        sendErrorDetails: false,
      }),
    ],
  });
  startBuildServerTask.done();
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
    stop: () => {
      server.stop();
    },
  };
};

export { startBuildServer };
