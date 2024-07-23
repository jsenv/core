// https://github.com/antfu/fs-spy/blob/main/src/index.ts
// https://github.com/tschaub/mock-fs/tree/main

import { removeDirectorySync, removeFileSync } from "@jsenv/filesystem";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { spyMethods } from "./spy_methods.js";

export const spyFilesystemCalls = (
  {
    writeFile = () => {},
    writeDirectory = () => {},
    removeFile = () => {},
    // removeDirectory = () => {},
  },
  { undoFilesystemSideEffects } = {},
) => {
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
      writeFile(fileUrl, stateAfter.content);
      return;
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
    writeDirectory(directoryUrl);
  };
  const spies = {
    mkdir: ({ callOriginal, args }) => {
      // prettier-ignore
      const [
        directoryPath, 
        /* mode */,
        /* recursive */,
        callback,
      ] = args;
      const directoryUrl = pathToFileURL(directoryPath);
      if (callback) {
        const stateBefore = getDirectoryState(directoryPath);
        const oncomplete = callback.oncomplete;
        callback.oncomplete = (error, fd) => {
          if (error) {
            oncomplete(error);
          } else {
            fileDescriptorPathMap.set(fd, directoryPath);
            oncomplete();
            onWriteDirectoryDone(directoryUrl, stateBefore, { found: true });
          }
        };
        return callOriginal();
      }
      const stateBefore = getDirectoryState(directoryPath);
      callOriginal();
      onWriteDirectoryDone(directoryUrl, stateBefore, { found: true });
      return undefined;
    },
    open: ({ callOriginal, args }) => {
      // prettier-ignore
      const [
        filePath, 
        /* flags */,
        /* mode */,
        callback,
      ] = args;
      if (callback) {
        const stateBefore = getFileState(filePath);
        filesystemStateInfoMap.set(filePath, stateBefore);
        const oncomplete = callback.oncomplete;
        callback.oncomplete = (error, fd) => {
          if (error) {
            oncomplete(error);
          } else {
            fileDescriptorPathMap.set(fd, filePath);
            oncomplete(error, fd);
          }
        };
        return callOriginal();
      }
      const stateBefore = getFileState(filePath);
      filesystemStateInfoMap.set(filePath, stateBefore);
      const fd = callOriginal();
      fileDescriptorPathMap.set(fd, filePath);
      return fd;
    },
    close: ({ callOriginal, args }) => {
      const [fileDescriptor] = args;
      const filePath = fileDescriptorPathMap.get(fileDescriptor);
      if (!filePath) {
        return callOriginal();
      }
      const openInfo = filesystemStateInfoMap.get(filePath);
      if (!openInfo) {
        const returnValue = callOriginal();
        fileDescriptorPathMap.delete(fileDescriptor);
        return returnValue;
      }
      const fileUrl = pathToFileURL(filePath);
      const nowState = getFileState(fileUrl);
      onWriteFileDone(fileUrl, openInfo, nowState);
      const returnValue = callOriginal();
      fileDescriptorPathMap.delete(fileDescriptor);
      filesystemStateInfoMap.delete(filePath);
      return returnValue;
    },
    // writeBuffer: ({ callOriginal, args }) => {
    //   const [filePath] = args;
    //   debugger;
    // },
    writeFileUtf8: ({ callOriginal, args }) => {
      const [filePath] = args;
      const fileUrl = pathToFileURL(filePath);
      const stateBefore = getFileState(fileUrl);
      callOriginal();
      const stateAfter = getFileState(fileUrl);
      onWriteFileDone(fileUrl, stateBefore, stateAfter);
    },
    unlink: removeFile, // TODO eventually call remove directory
  };
  const restoreCallbackSet = new Set();
  const unspy = spyMethods(_internalFs, spies, {
    preventCallToOriginal: true,
  });
  restoreCallbackSet.add(() => {
    unspy();
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
