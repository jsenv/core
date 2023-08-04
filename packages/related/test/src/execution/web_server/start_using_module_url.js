import { existsSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { Abort } from "@jsenv/abort";

import { pingServer } from "../../helpers/ping_server.js";

export const startServerUsingModuleUrl = async (
  webServer,
  { signal, teardown, logger, allocatedMs },
) => {
  if (!existsSync(new URL(webServer.moduleUrl))) {
    throw new Error(
      `webServer.moduleUrl does not lead to a file at "${webServer.moduleUrl}"`,
    );
  }
  const worker = new Worker(
    new URL(
      "./worker_importing_module_starting_web_server.mjs",
      import.meta.url,
    ),
    {
      workerData: {
        url: String(webServer.moduleUrl),
      },
      env: {
        IMPORTED_BY_TEST_PLAN: "1",
      },
      stdin: true,
      stdout: true,
    },
  );
  let errorReceived = false;
  const errorPromise = new Promise((resolve, reject) => {
    worker.on("error", (e) => {
      errorReceived = true;
      reject(e);
    });
  });

  const killWorker = async () => {
    await worker.terminate();
  };

  const startOperation = Abort.startOperation();
  startOperation.addAbortSignal(signal);
  const timeoutAbortSource = startOperation.timeout(allocatedMs);
  startOperation.addAbortCallback(killWorker);
  teardown.addCallback(killWorker);

  const startedPromise = (async () => {
    const logScale = [100, 250, 500];
    // eslint-disable-next-line no-constant-condition
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
          `"${webServer.moduleUrl}" did not start a server in less than ${allocatedMs}ms (webServer.moduleUrl)`,
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
