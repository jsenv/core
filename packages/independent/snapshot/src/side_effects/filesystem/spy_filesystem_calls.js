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
import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  disableHooksWhileCalling,
  hookIntoMethod,
  METHOD_EXECUTION_NODE_CALLBACK,
} from "../hook_into_method.js";

export const spyFilesystemCalls = (
  {
    readFile = () => {}, // TODO
    writeFile = () => {},
    writeDirectory = () => {},
    removeFile = () => {}, // TODO
    // removeDirectory = () => {},
  },
  { include, undoFilesystemSideEffects } = {},
) => {
  const shouldReport = include
    ? URL_META.createFilter(include, "file:///")
    : () => true;

  const _internalFs = process.binding("fs");
  const filesystemStateInfoMap = new Map();
  const fileDescriptorPathMap = new Map();
  const fileRestoreMap = new Map();
  const onWriteFileDone = (fileUrl, stateBefore, stateAfter) => {
    // we use same type because we don't want to differentiate between
    // - writing file for the 1st time
    // - updating file content
    // the important part is the file content in the end of the function execution
    if (
      (!stateBefore.found && stateAfter.found) ||
      stateBefore.content !== stateAfter.content ||
      stateBefore.mtimeMs !== stateAfter.mtimeMs
    ) {
      if (undoFilesystemSideEffects && !fileRestoreMap.has(fileUrl)) {
        if (stateBefore.found) {
          fileRestoreMap.set(fileUrl, () => {
            writeFileSync(fileUrl, stateBefore.content);
          });
        } else {
          fileRestoreMap.set(fileUrl, () => {
            removeFileSync(fileUrl, { allowUseless: true });
          });
        }
      }
      if (shouldReport(fileUrl)) {
        writeFile(fileUrl, stateAfter.content);
        return;
      }
    }
    // file is exactly the same
    // function did not have any effect on the file
  };
  const onWriteDirectoryDone = (directoryUrl, stateBefore) => {
    if (stateBefore.found) {
      return;
    }
    if (undoFilesystemSideEffects && !fileRestoreMap.has(directoryUrl)) {
      fileRestoreMap.set(directoryUrl, () => {
        removeDirectorySync(directoryUrl, {
          allowUseless: true,
          recursive: true,
        });
      });
    }
    if (shouldReport(directoryUrl)) {
      writeDirectory(directoryUrl);
    }
  };
  const beforeUndoCallbackSet = new Set();
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
    (directoryPath) => {
      const directoryUrl = pathToFileURL(directoryPath);
      const stateBefore = getDirectoryState(directoryPath);
      return {
        return: (fd) => {
          fileDescriptorPathMap.set(fd, directoryPath);
          onWriteDirectoryDone(directoryUrl, stateBefore, { found: true });
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
            readFile(fileUrl);
          }
          fileDescriptorPathMap.delete(fileDescriptor);
          filesystemStateInfoMap.delete(filePath);
          const stateAfter = getFileStateWithinHook(fileUrl);
          onWriteFileDone(fileUrl, stateBefore, stateAfter);
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
          onWriteFileDone(fileUrl, stateBefore, stateAfter);
        },
      };
    },
  );
  const unlinkHook = hookIntoMethod(_internalFs, "unlink", (filePath) => {
    return {
      return: () => {
        removeFile(filePath); // TODO eventually split in removeFile/removeDirectory
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
    addBeforeUndoCallback: (callback) => {
      beforeUndoCallbackSet.add(callback);
    },
    restore: () => {
      for (const restoreCallback of restoreCallbackSet) {
        restoreCallback();
      }
      restoreCallbackSet.clear();
      for (const beforeUndoCallback of beforeUndoCallbackSet) {
        beforeUndoCallback();
      }
      beforeUndoCallbackSet.clear();
      for (const [, restore] of fileRestoreMap) {
        restore();
      }
      fileRestoreMap.clear();
    },
  };
};

const getFileState = (file) => {
  try {
    const fileContent = readFileSync(file);
    const { mtimeMs } = statSync(file);
    return {
      found: true,
      mtimeMs,
      content: String(fileContent),
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
