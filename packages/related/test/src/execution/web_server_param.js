import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";
import { basicFetch } from "../helpers/basic_fetch.js";
import { pingServer } from "../helpers/ping_server.js";
import { startServerUsingCommand } from "./web_server/start_using_command.js";
import { startServerUsingModuleUrl } from "./web_server/start_using_module_url.js";

export const assertAndNormalizeWebServer = async (
  webServer,
  { signal, logger, teardownCallbackSet },
) => {
  if (!webServer) {
    throw new TypeError(
      `webServer is required when running tests on browser(s)`,
    );
  }
  const unexpectedParamNames = Object.keys(webServer).filter((key) => {
    return ![
      "origin",
      "moduleUrl",
      "command",
      "cwd",
      "rootDirectoryUrl",
    ].includes(key);
  });
  if (unexpectedParamNames.length > 0) {
    throw new TypeError(
      `${unexpectedParamNames.join(",")}: there is no such param to webServer`,
    );
  }
  if (typeof webServer.origin !== "string") {
    throw new TypeError(
      `webServer.origin must be a string, got ${webServer.origin}`,
    );
  }
  await ensureWebServerIsStarted(webServer, {
    signal,
    teardownCallbackSet,
    logger,
  });
  const serverJsonResponse = await basicFetch(
    `${webServer.origin}/.internal/server.json`,
    {
      method: "GET",
      rejectUnauthorized: false,
    },
  );
  if (
    serverJsonResponse.status === 200 &&
    String(serverJsonResponse.headers["server"]).includes("jsenv_dev_server")
  ) {
    webServer.isJsenvDevServer = true;
    if (webServer.rootDirectoryUrl === undefined) {
      const jsenvDevServerParams = await serverJsonResponse.json();
      webServer.rootDirectoryUrl = jsenvDevServerParams.sourceDirectoryUrl;
    } else {
      webServer.rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
        webServer.rootDirectoryUrl,
        "webServer.rootDirectoryUrl",
      );
    }
  } else {
    webServer.rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
      webServer.rootDirectoryUrl,
      "webServer.rootDirectoryUrl",
    );
  }
};

export const ensureWebServerIsStarted = async (
  webServer,
  {
    signal,
    teardownCallbackSet,
    logger,
    allocatedMs = 5_000,
    ignoreProcessExecArgv,
  },
) => {
  const aServerIsListening = await pingServer(webServer.origin);
  if (aServerIsListening) {
    return;
  }
  if (webServer.moduleUrl) {
    await startServerUsingModuleUrl(webServer, {
      ignoreProcessExecArgv,
      signal,
      allocatedMs,
      teardownCallbackSet,
      logger,
    });
    return;
  }
  if (webServer.command) {
    await startServerUsingCommand(webServer, {
      signal,
      allocatedMs,
      teardownCallbackSet,
      logger,
    });
    return;
  }
  throw new TypeError(
    `webServer.moduleUrl or webServer.command is required as there is no server listening "${webServer.origin}"`,
  );
};
