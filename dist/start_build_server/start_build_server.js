import { startServer, jsenvServiceCORS, jsenvServiceErrorHandler, jsenvAccessControlAllowedHeaders, createFileSystemFetch } from "@jsenv/server";
import { existsSync } from "node:fs";
import { assertAndNormalizeDirectoryUrl$2 as assertAndNormalizeDirectoryUrl, createLogger$2 as createLogger, Abort$1 as Abort, raceProcessTeardownEvents$1 as raceProcessTeardownEvents, createTaskLog$2 as createTaskLog, urlToExtension$2 as urlToExtension, urlToPathname$2 as urlToPathname } from "../jsenv_core_packages.js";
import "string-width";
import "strip-ansi";
import "../jsenv_core_node_modules.js";
import "node:process";
import "node:os";
import "node:tty";
import "node:path";
import "node:crypto";
import "node:url";
import "@jsenv/ast";
import "@jsenv/sourcemap";
import "node:module";
import "@jsenv/js-module-fallback";

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
  buildMainFilePath = "index.html",
  port = 9779,
  routes,
  services = [],
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

    if (buildMainFilePath) {
      if (typeof buildMainFilePath !== "string") {
        throw new TypeError(
          `buildMainFilePath must be a string, got ${buildMainFilePath}`,
        );
      }
      if (buildMainFilePath[0] === "/") {
        buildMainFilePath = buildMainFilePath.slice(1);
      } else {
        const buildMainFileUrl = new URL(buildMainFilePath, buildDirectoryUrl)
          .href;
        if (!buildMainFileUrl.startsWith(buildDirectoryUrl)) {
          throw new Error(
            `buildMainFilePath must be relative, got ${buildMainFilePath}`,
          );
        }
        buildMainFilePath = buildMainFileUrl.slice(buildDirectoryUrl.length);
      }
      if (!existsSync(new URL(buildMainFilePath, buildDirectoryUrl))) {
        buildMainFilePath = null;
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
      jsenvBuildFileService({
        buildDirectoryUrl,
        buildMainFilePath,
      }),
      jsenvServiceErrorHandler({
        sendErrorDetails: true,
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

const jsenvBuildFileService = ({ buildDirectoryUrl, buildMainFilePath }) => {
  return {
    name: "jsenv:build_files",
    routes: [
      {
        endpoint: "GET *",
        description: "Serve static files.",
        fetch: (request, helpers) => {
          const urlIsVersioned = new URL(request.url).searchParams.has("v");
          if (buildMainFilePath && request.resource === "/") {
            request = {
              ...request,
              resource: `/${buildMainFilePath}`,
            };
          }
          const urlObject = new URL(
            request.resource.slice(1),
            buildDirectoryUrl,
          );
          return createFileSystemFetch(buildDirectoryUrl, {
            cacheControl: urlIsVersioned
              ? `private,max-age=${SECONDS_IN_30_DAYS},immutable`
              : "private,max-age=0,must-revalidate",
            etagEnabled: true,
            compressionEnabled: true,
            rootDirectoryUrl: buildDirectoryUrl,
            canReadDirectory: true,
            ENOENTFallback: () => {
              if (
                !urlToExtension(urlObject) &&
                !urlToPathname(urlObject).endsWith("/")
              ) {
                return new URL(buildMainFilePath, buildDirectoryUrl);
              }
              return null;
            },
          })(request, helpers);
        },
      },
    ],
  };
};

const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30;

export { startBuildServer };
