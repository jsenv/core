import { fileURLToPath } from "node:url";
import { Abort } from "@jsenv/abort";

import { pingServer } from "../../helpers/ping_server.js";

export const startServerUsingModuleUrl = async (
  webServer,
  { signal, allocatedMs },
) => {
  const startOperation = Abort.startOperation();
  startOperation.addAbortSignal(signal);
  const timeoutAbortSource = startOperation.timeout(allocatedMs);

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
          `"${webServer.moduleUrl}" file did not start a server in less than ${allocatedMs}ms (webServer.moduleUrl)`,
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
