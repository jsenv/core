import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { Abort } from "@jsenv/abort";
import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";

import { pingServer } from "../helpers/ping_server.js";
import { basicFetch } from "../helpers/basic_fetch.js";

export const assertAndNormalizeWebServer = async (
  webServer,
  { signal, logger, teardown },
) => {
  if (!webServer) {
    throw new TypeError(
      `webServer is required when running tests on browser(s)`,
    );
  }
  const unexpectedParamNames = Object.keys(webServer).filter((key) => {
    return !["origin", "moduleUrl", "rootDirectoryUrl"].includes(key);
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

  const aServerIsListening = await pingServer(webServer.origin);
  if (!aServerIsListening) {
    if (webServer.moduleUrl) {
      await startServerUsingDynamicImport(webServer, {
        signal,
        teardown,
        logger,
      });
    } else if (webServer.command) {
      await startServerUsingCommand(webServer, { signal, teardown, logger });
    } else {
      throw new TypeError(
        `webServer.moduleUrl or webServer.command is required as there is no server listening "${webServer.origin}"`,
      );
    }
  }
  const { headers } = await basicFetch(webServer.origin, {
    method: "GET",
    rejectUnauthorized: false,
    headers: {
      "x-server-inspect": "1",
    },
  });
  if (String(headers["server"]).includes("jsenv_dev_server")) {
    webServer.isJsenvDevServer = true;
    const { json } = await basicFetch(`${webServer.origin}/__params__.json`, {
      rejectUnauthorized: false,
    });
    if (webServer.rootDirectoryUrl === undefined) {
      const jsenvDevServerParams = await json();
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

const startServerUsingDynamicImport = async (webServer, { signal }) => {
  const startOperation = Abort.startOperation();
  startOperation.addAbortSignal(signal);

  const importTimeoutMs = 5_000;
  const timeoutAbortSource = startOperation.timeout(importTimeoutMs);

  const doImport = async () => {
    try {
      process.env.IMPORTED_BY_TEST_PLAN = "1";
      await import(webServer.moduleUrl);
      delete process.env.IMPORTED_BY_TEST_PLAN;
    } catch (e) {
      if (
        e.code === "ERR_MODULE_NOT_FOUND" &&
        e.message.includes(fileURLToPath(webServer.moduleUrl))
      ) {
        throw new Error(
          `webServer.moduleUrl does not lead to a file at "${webServer.moduleUrl}"`,
        );
      }
      throw e;
    }
  };

  try {
    await doImport();
    const aServerIsListening = await pingServer(webServer.origin);
    if (!aServerIsListening) {
      throw new Error(
        `"${webServer.moduleUrl}" file did not start a server listening at "${webServer.origin}" (webServer.moduleUrl)`,
      );
    }
  } catch (e) {
    if (Abort.isAbortError(e)) {
      if (timeoutAbortSource.signal.aborted) {
        // aborted by timeout
        throw new Error(
          `"${webServer.moduleUrl}" file did not start a server in less than ${importTimeoutMs}ms (webServer.moduleUrl)`,
        );
      }
      if (signal.aborted) {
        // aborted from outside
        return;
      }
    }
    throw e;
  } finally {
    await startOperation.end();
  }
};

const startServerUsingCommand = async (
  webServer,
  { signal, logger, teardown },
) => {
  const spawnedProcess = spawn(webServer.command, [], {
    // On non-windows platforms, `detached: true` makes child process a leader of a new
    // process group, making it possible to kill child process tree with `.kill(-pid)` command.
    // @see https://nodejs.org/api/child_process.html#child_process_options_detached
    detached: process.platform !== "win32",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (!spawnedProcess.pid) {
    await new Promise((resolve, reject) => {
      spawnedProcess.once("error", (error) => {
        reject(new Error(`Failed to launch: ${error}`));
      });
    });
  }
  spawnedProcess.on("error", () => {});
  // const stdout = readline.createInterface({ input: spawnedProcess.stdout });
  // stdout.on("line", () => {
  //   logger.debug(`[pid=${spawnedProcess.pid}][out] ${data}`);
  // });
  // const stderr = readline.createInterface({ input: spawnedProcess.stderr });
  // stderr.on("line", (data) => {
  //   logger.debug(`[pid=${spawnedProcess.pid}][err] ${data}`);
  // });
  let processClosed = false;
  const closedPromise = new Promise((resolve) => {
    spawnedProcess.once("exit", (exitCode, signal) => {
      logger.info(
        `[pid=${spawnedProcess.pid}] <process did exit: exitCode=${exitCode}, signal=${signal}>`,
      );
      processClosed = true;
      resolve();
    });
  });
  const killProcess = async () => {
    logger.info(`[pid=${spawnedProcess.pid}] <kill>`);
    if (!spawnedProcess.pid || spawnedProcess.killed || processClosed) {
      logger.info(
        `[pid=${spawnedProcess.pid}] <skipped force kill spawnedProcess.killed=${spawnedProcess.killed} processClosed=${processClosed}>`,
      );
      return;
    }
    logger.info(`[pid=${spawnedProcess.pid}] <will force kill>`);
    // Force kill the browser.
    try {
      if (process.platform === "win32") {
        const taskkillProcess = spawnSync(
          `taskkill /pid ${spawnedProcess.pid} /T /F`,
          { shell: true },
        );
        const [stdout, stderr] = [
          taskkillProcess.stdout.toString(),
          taskkillProcess.stderr.toString(),
        ];
        if (stdout)
          logger.info(`[pid=${spawnedProcess.pid}] taskkill stdout: ${stdout}`);
        if (stderr)
          logger.info(`[pid=${spawnedProcess.pid}] taskkill stderr: ${stderr}`);
      } else {
        process.kill(-spawnedProcess.pid, "SIGKILL");
      }
    } catch (e) {
      logger.info(
        `[pid=${spawnedProcess.pid}] exception while trying to kill process: ${e}`,
      );
      // the process might have already stopped
    }
    await closedPromise;
  };

  const startOperation = Abort.startOperation();
  startOperation.addAbortSignal(signal);

  startOperation.addAbortCallback(killProcess);
  teardown.addCallback(killProcess);

  const startTimeoutMs = 5_000;
  const timeoutAbortSource = startOperation.timeout(startTimeoutMs);

  try {
    const logScale = [100, 250, 500];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const connected = await pingServer(webServer.origin);
      if (connected) {
        break;
      }
      startOperation.throwIfAborted();
      const delay = logScale.shift() || 1000;
      logger.debug(`Waiting ${delay}ms`);
      await new Promise((x) => setTimeout(x, delay));
    }
  } catch (e) {
    if (Abort.isAbortError(e)) {
      if (timeoutAbortSource.signal.aborted) {
        // aborted by timeout
        throw new Error(
          `"${webServer.command}" command did not start a server in less than ${startTimeoutMs}ms (webServer.command)`,
        );
      }
      if (signal.aborted) {
        // aborted from outside
        return;
      }
    }
    throw e;
  } finally {
    await startOperation.end();
  }
};
