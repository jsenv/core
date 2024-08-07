// https://github.com/antfu/fs-spy/blob/main/src/index.ts
// https://github.com/tschaub/mock-fs/tree/main
// https://github.com/tschaub/mock-fs/blob/6e84d5bb320022624c7d770432e3322323ce043e/lib/binding.js#L353
// https://github.com/tschaub/mock-fs/issues/348

import {
  removeDirectorySync,
  removeFileSync,
  writeFileSync,
} from "@jsenv/filesystem";
import { URL_META } from "@jsenv/url-meta";
import { ensurePathnameTrailingSlash, yieldAncestorUrls } from "@jsenv/urls";
import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  disableHooksWhileCalling,
  hookIntoMethod,
  METHOD_EXECUTION_NODE_CALLBACK,
} from "../hook_into_method.js";

export const spyFilesystemCalls = (
  {
    onReadFile = () => {}, // TODO
    onWriteFile = () => {},
    onWriteDirectory = () => {},
    onRemoveFile = () => {}, // TODO
    // removeDirectory = () => {},
  },
  { include, undoFilesystemSideEffects } = {},
) => {
  const getAction = include
    ? (() => {
        const associations = URL_META.resolveAssociations(
          {
            action: include,
          },
          "file:///",
        );
        return (url) => {
          const meta = URL_META.applyAssociations({ url, associations });
          return meta.action;
        };
      })()
    : () => "compare";

  const _internalFs = process.binding("fs");
  const filesystemStateInfoMap = new Map();
  const fileDescriptorPathMap = new Map();
  const fileRestoreMap = new Map();
  const onWriteFileDone = (fileUrl, stateBefore, stateAfter) => {
    if (!stateAfter.found) {
      // seems to be possible somehow
      return;
    }
    // we use same type because we don't want to differentiate between
    // - writing file for the 1st time
    // - updating file content
    // the important part is the file content in the end of the function execution
    const reason =
      !stateBefore.found && stateAfter.found
        ? "created"
        : Buffer.compare(stateBefore.buffer, stateAfter.buffer)
          ? "content_modified"
          : stateBefore.mtimeMs === stateAfter.mtimeMs
            ? ""
            : "mtime_modified";
    if (!reason) {
      // file is exactly the same
      // function did not have any effect on the file
      return;
    }
    const action = getAction(fileUrl);
    const shouldCompare =
      action === "compare" ||
      action === "compare_presence_only" ||
      action === true;
    if (action === "undo" || shouldCompare) {
      if (undoFilesystemSideEffects && !fileRestoreMap.has(fileUrl)) {
        if (stateBefore.found) {
          fileRestoreMap.set(fileUrl, () => {
            writeFileSync(fileUrl, stateBefore.buffer);
          });
        } else {
          fileRestoreMap.set(fileUrl, () => {
            removeFileSync(fileUrl, { allowUseless: true });
          });
        }
      }
    }
    if (shouldCompare) {
      onWriteFile(fileUrl, stateAfter.buffer, reason);
    }
    // "ignore", false, anything else
  };
  const onWriteDirectoryDone = (directoryUrl) => {
    const action = getAction(directoryUrl);
    const shouldCompare =
      action === "compare" ||
      action === "compare_presence_only" ||
      action === true;
    if (action === "undo" || shouldCompare) {
      if (undoFilesystemSideEffects && !fileRestoreMap.has(directoryUrl)) {
        fileRestoreMap.set(directoryUrl, () => {
          removeDirectorySync(directoryUrl, {
            allowUseless: true,
            recursive: true,
          });
        });
      }
    }
    if (shouldCompare) {
      onWriteDirectory(directoryUrl);
    }
    // "ignore", false, anything else
  };
  const restoreCallbackSet = new Set();

  const getFileStateWithinHook = (fileUrl) => {
    return disableHooksWhileCalling(
      () => getFileState(fileUrl),
      [openHook, closeHook],
    );
  };

  const mkdirHook = hookIntoMethod(
    _internalFs,
    "mkdir",
    (directoryPath, mode, recursive) => {
      const directoryUrl = ensurePathnameTrailingSlash(
        pathToFileURL(directoryPath),
      );
      const stateBefore = getDirectoryState(directoryPath);
      if (!stateBefore.found && recursive) {
        const ancestorNotFoundArray = [];
        for (const ancestorUrl of yieldAncestorUrls(directoryUrl)) {
          const ancestorState = getDirectoryState(new URL(ancestorUrl));
          if (ancestorState.found) {
            break;
          }
          ancestorNotFoundArray.unshift(
            ensurePathnameTrailingSlash(ancestorUrl),
          );
        }
        return {
          return: (fd) => {
            fileDescriptorPathMap.set(fd, directoryPath);
            for (const ancestorNotFoundUrl of ancestorNotFoundArray) {
              onWriteDirectoryDone(ancestorNotFoundUrl);
            }
            onWriteDirectoryDone(String(directoryUrl));
          },
        };
      }
      return {
        return: (fd) => {
          fileDescriptorPathMap.set(fd, directoryPath);
          if (!stateBefore.found) {
            onWriteDirectoryDone(String(directoryUrl));
          }
        },
      };
    },
    { execute: METHOD_EXECUTION_NODE_CALLBACK },
  );
  const openHook = hookIntoMethod(
    _internalFs,
    "open",
    (filePath) => {
      const stateBefore = getFileStateWithinHook(filePath);
      filesystemStateInfoMap.set(filePath, stateBefore);
      return {
        return: (fd) => {
          if (typeof fd === "number") {
            fileDescriptorPathMap.set(fd, filePath);
          } else {
            // it's a buffer (happens for readFile)
          }
        },
      };
    },
    { execute: METHOD_EXECUTION_NODE_CALLBACK },
  );
  /*
   * Relying on open/close to detect writes is done to be able to catch
   * write done async, not sure how to distinguish open/close done to write
   * from open/close done to read file stat
   * open/close for file stat are excluded because we compare stateBefore/stateAfter
   * but ideally we would early return by detecting open/close is not for write operations
   */
  const closeHook = hookIntoMethod(
    _internalFs,
    "close",
    (fileDescriptor) => {
      return {
        return: (buffer) => {
          const filePath = fileDescriptorPathMap.get(fileDescriptor);
          if (!filePath) {
            return;
          }
          const stateBefore = filesystemStateInfoMap.get(filePath);
          if (!stateBefore) {
            fileDescriptorPathMap.delete(fileDescriptor);
            return;
          }
          const fileUrl = pathToFileURL(filePath);
          if (buffer) {
            onReadFile(String(fileUrl));
          }
          fileDescriptorPathMap.delete(fileDescriptor);
          filesystemStateInfoMap.delete(filePath);
          const stateAfter = getFileStateWithinHook(fileUrl);
          onWriteFileDone(String(fileUrl), stateBefore, stateAfter);
        },
      };
    },
    { execute: METHOD_EXECUTION_NODE_CALLBACK },
  );
  const writeFileUtf8Hook = hookIntoMethod(
    _internalFs,
    "writeFileUtf8",
    (filePath) => {
      const fileUrl = pathToFileURL(filePath);
      const stateBefore = getFileStateWithinHook(fileUrl);
      return {
        return: () => {
          const stateAfter = getFileStateWithinHook(fileUrl);
          onWriteFileDone(String(fileUrl), stateBefore, stateAfter);
        },
      };
    },
  );
  const unlinkHook = hookIntoMethod(_internalFs, "unlink", (filePath) => {
    return {
      return: () => {
        onRemoveFile(filePath); // TODO eventually split in removeFile/removeDirectory
      },
    };
  });
  restoreCallbackSet.add(() => {
    mkdirHook.remove();
    openHook.remove();
    closeHook.remove();
    writeFileUtf8Hook.remove();
    unlinkHook.remove();
  });
  return {
    restore: () => {
      for (const restoreCallback of restoreCallbackSet) {
        restoreCallback();
      }
      restoreCallbackSet.clear();
      for (const [, restore] of fileRestoreMap) {
        restore();
      }
      fileRestoreMap.clear();
    },
  };
};

const getFileState = (file) => {
  try {
    const fileBuffer = readFileSync(file);
    const { mtimeMs } = statSync(file);
    return {
      found: true,
      mtimeMs,
      buffer: fileBuffer,
    };
  } catch (e) {
    if (e.code === "ENOENT") {
      return {
        found: false,
      };
    }
    throw e;
  }
};

const getDirectoryState = (directory) => {
  try {
    statSync(directory);
    return {
      found: true,
    };
  } catch (e) {
    if (e.code === "ENOENT") {
      return {
        found: false,
      };
    }
    throw e;
  }
};
