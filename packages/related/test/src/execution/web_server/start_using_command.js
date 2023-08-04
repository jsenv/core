import { spawn, spawnSync } from "node:child_process";
import { Abort } from "@jsenv/abort";

import { pingServer } from "../../helpers/ping_server.js";

export const startServerUsingCommand = async (
  webServer,
  { signal, allocatedMs, logger, teardown },
) => {
  const spawnedProcess = spawn(webServer.command, [], {
    // On non-windows platforms, `detached: true` makes child process a leader of a new
    // process group, making it possible to kill child process tree with `.kill(-pid)` command.
    // @see https://nodejs.org/api/child_process.html#child_process_options_detached
    detached: process.platform !== "win32",
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
    cwd: webServer.cwd,
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
  const timeoutAbortSource = startOperation.timeout(allocatedMs);
  startOperation.addAbortCallback(killProcess);
  teardown.addCallback(killProcess);

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
          `"${webServer.command}" command did not start a server in less than ${allocatedMs}ms (webServer.command)`,
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
