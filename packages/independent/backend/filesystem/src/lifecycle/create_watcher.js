import { closeSync, openSync, watch } from "node:fs";
import { generateWindowsEPERMErrorMessage } from "../window_eperm_error.js";

const isWindows = process.platform === "win32";

export const createWatcher = (sourcePath, options) => {
  const watcher = watch(sourcePath, options);

  if (isWindows) {
    watcher.on("error", async (error) => {
      // https://github.com/joyent/node/issues/4337
      if (error.code === "EPERM") {
        try {
          const fd = openSync(sourcePath, "r");
          closeSync(fd);
        } catch (e) {
          if (e.code === "ENOENT") {
            return;
          }
          console.error(
            generateWindowsEPERMErrorMessage(error, {
              operation: "watch",
              path: sourcePath,
            }),
          );
          throw error;
        }
      } else {
        throw error;
      }
    });
  }

  return watcher;
};
