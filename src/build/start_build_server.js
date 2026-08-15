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

import { Abort, raceProcessTeardownEvents } from "@jsenv/abort";
import { createLogger, createTaskLog } from "@jsenv/humanize";
import {
  createFileSystemFetch,
  jsenvAccessControlAllowedHeaders,
  serverPluginCORS,
  serverPluginErrorHandler,
  startServer,
} from "@jsenv/server";

import { injectRibbonIntoHtml } from "../plugins/ribbon/ribbon_html_injection.js";

/**
 * Start a server for build files.
 * @param {Object} buildServerParameters
 * @param {string|url} buildServerParameters.buildDirectoryUrl Directory where build files are written
 * @param {boolean|object} [buildServerParameters.ribbon=false] Inject a ribbon in the html responses,
 *        marking the page as non-production. The build directory itself is left untouched.
 *        As an object: `text`, `color`, `textColor`, `href`, `target`, `position`
 *        (see startDevServer "ribbon" param).
 * @return {Object} A build server object
 */
export const startBuildServer = async ({
  buildDirectoryUrl,
  buildDirectoryMainFileRelativeUrl = "index.html",
  ribbon = false,
  port = 9779,
  routes = [],
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
}) => {
  const logger = createLogger({ logLevel });
  if (ribbon === true) {
    ribbon = {};
  }
  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      );
    });
  }

  const fileSystemFetch = createFileSystemFetch(buildDirectoryUrl, {
    mainFileRelativeUrl: buildDirectoryMainFileRelativeUrl,
  });
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
      serverPluginErrorHandler({
        sendErrorDetails: false,
      }),
    ],
    routes: [
      ...routes,
      {
        endpoint: "GET /",
        description: "Serve build files",
        fetch: ribbon
          ? withRibbonInjectedInHtml(fileSystemFetch, ribbon)
          : fileSystemFetch,
      },
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

const withRibbonInjectedInHtml = (fetch, ribbon) => {
  return async (request, helpers) => {
    const response = await fetch(request, helpers);
    if (!response || response.status !== 200) {
      return response;
    }
    const contentType = response.headers?.["content-type"];
    if (!contentType || !contentType.startsWith("text/html")) {
      return response;
    }
    const html = await readResponseBodyAsString(response.body);
    const htmlWithRibbon = injectRibbonIntoHtml(html, ribbon);
    const bodyBuffer = Buffer.from(htmlWithRibbon);
    const headers = {
      ...response.headers,
      "content-length": bodyBuffer.length,
    };
    // the body is generated per request; what the file on disk hashes to or when
    // it was modified does not describe it
    delete headers.etag;
    delete headers["last-modified"];
    return {
      ...response,
      headers,
      body: bodyBuffer,
    };
  };
};

const readResponseBodyAsString = async (body) => {
  if (typeof body === "string" || Buffer.isBuffer(body)) {
    return String(body);
  }
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
  }
  return String(Buffer.concat(chunks));
};
