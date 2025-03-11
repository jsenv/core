import { Abort } from "@jsenv/abort";
import { spawn, spawnSync } from "node:child_process";
import { pingServer } from "../../helpers/ping_server.js";

export const startServerUsingCommand = async (
  webServer,
  { signal, allocatedMs, logger, teardownCallbackSet, shell = true },
) => {
  const spawnedProcess = spawn(webServer.command, webServer.args || [], {
    // On non-windows platforms, `detached: true` makes child process a leader of a new
    // process group, making it possible to kill child process tree with `.kill(-pid)` command.
    // @see https://nodejs.org/api/child_process.html#child_process_options_detached
    detached: process.platform !== "win32",
    stdio: ["pipe", "pipe", "pipe"],
    shell,
    cwd: webServer.cwd,
  });
  if (!spawnedProcess.pid) {
    await new Promise((resolve, reject) => {
      spawnedProcess.once("error", (error) => {
        reject(new Error(`Failed to launch: ${error}`));
      });
    });
  }

  let errorReceived = false;
  const errorPromise = new Promise((resolve, reject) => {
    spawnedProcess.on("error", (e) => {
      errorReceived = true;
      reject(e);
    });
  });

  // const stdout = readline.createInterface({ input: spawnedProcess.stdout });
  // stdout.on("line", () => {
  //   logger.debug(`[pid=${spawnedProcess.pid}][out] ${data}`);
  // });
  // const stderr = readline.createInterface({ input: spawnedProcess.stderr });
  // stderr.on("line", (data) => {
  //   logger.debug(`[pid=${spawnedProcess.pid}][err] ${data}`);
  // });
  let isAbort = false;
  let isTeardown = false;
  let processClosed = false;
  spawnedProcess.stderr.on("data", (data) => {
    logger.error(String(data));
  });
  const closedPromise = new Promise((resolve) => {
    spawnedProcess.once("exit", (exitCode, signal) => {
      processClosed = true;
      if (isAbort || isTeardown) {
        logger.debug(
          `web server process exit exitCode=${exitCode}, exitSignal=${signal}, pid=${spawnedProcess.pid}`,
        );
      } else {
        logger.error(
          `web server process premature exit exitCode=${exitCode}, exitSignal=${signal}, pid=${spawnedProcess.pid}`,
        );
      }
      resolve();
    });
  });
  const killProcess = async () => {
    logger.debug(`[pid=${spawnedProcess.pid}] <kill>`);
    if (!spawnedProcess.pid || spawnedProcess.killed || processClosed) {
      logger.debug(
        `[pid=${spawnedProcess.pid}] <skipped force kill spawnedProcess.killed=${spawnedProcess.killed} processClosed=${processClosed}>`,
      );
      return;
    }
    logger.debug(`[pid=${spawnedProcess.pid}] <will force kill>`);
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
          logger.debug(
            `[pid=${spawnedProcess.pid}] taskkill stdout: ${stdout}`,
          );
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
  const timeoutAbortSource = startOperation.timeout(allocatedMs);
  startOperation.addAbortCallback(async () => {
    isAbort = true;
    await killProcess();
  });
  teardownCallbackSet.add(async () => {
    isTeardown = true;
    await killProcess();
  });

  const startedPromise = (async () => {
    const logScale = [100, 250, 500];
    while (true) {
      if (errorReceived) {
        break;
      }
      const connected = await pingServer(webServer.origin);
      if (connected) {
        break;
      }
      startOperation.throwIfAborted();
      const delay = logScale.shift() || 1000;
      logger.debug(`Waiting ${delay}ms`);
      await new Promise((x) => setTimeout(x, delay));
    }
  })();

  try {
    await Promise.race([errorPromise, startedPromise]);
  } catch (e) {
    if (Abort.isAbortError(e)) {
      if (timeoutAbortSource.signal.aborted) {
        // aborted by timeout
        throw new Error(
          `"${webServer.command}" command did not start a server at ${webServer.origin} in less than ${allocatedMs}ms`,
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
