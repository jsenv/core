// https://github.com/antfu/fs-spy/blob/main/src/index.ts
// https://github.com/tschaub/mock-fs/tree/main

import { removeDirectorySync, removeFileSync } from "@jsenv/filesystem";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { spyMethod } from "./spy_method.js";

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
  const restoreCallbackSet = new Set();
  const mkdirSpy = spyMethod(
    _internalFs,
    "mkdir",
    (directoryPath, mode, recursive, callback) => {
      const directoryUrl = pathToFileURL(directoryPath);
      if (callback) {
        const stateBefore = getDirectoryState(directoryPath);
        const oncomplete = callback.oncomplete;
        callback.oncomplete = (error, fd) => {
          if (error) {
            oncomplete.call(callback, error);
          } else {
            fileDescriptorPathMap.set(fd, directoryPath);
            oncomplete.call(callback);
            onWriteDirectoryDone(directoryUrl, stateBefore, { found: true });
          }
        };
        return mkdirSpy.callOriginal();
      }
      const stateBefore = getDirectoryState(directoryPath);
      mkdirSpy.callOriginal();
      onWriteDirectoryDone(directoryUrl, stateBefore, { found: true });
      return undefined;
    },
  );
  const openSpy = spyMethod(
    _internalFs,
    "open",
    (filePath, flags, mode, callback) => {
      if (callback) {
        const stateBefore = getFileState(filePath);
        filesystemStateInfoMap.set(filePath, stateBefore);
        const oncomplete = callback.oncomplete;
        callback.oncomplete = (error, fd) => {
          if (error) {
            oncomplete.call(callback, error);
          } else {
            fileDescriptorPathMap.set(fd, filePath);
            oncomplete.call(callback, error, fd);
          }
        };
        return openSpy.callOriginal();
      }
      const stateBefore = getFileState(filePath);
      filesystemStateInfoMap.set(filePath, stateBefore);
      const fd = openSpy.callOriginal();
      fileDescriptorPathMap.set(fd, filePath);
      return fd;
    },
  );
  const closeSpy = spyMethod(
    _internalFs,
    "close",
    (fileDescriptor, callback) => {
      const filePath = fileDescriptorPathMap.get(fileDescriptor);
      if (!filePath) {
        closeSpy.callOriginal();
        return;
      }
      const stateBefore = filesystemStateInfoMap.get(filePath);
      if (!stateBefore) {
        closeSpy.callOriginal();
        fileDescriptorPathMap.delete(fileDescriptor);
        return;
      }
      const fileUrl = pathToFileURL(filePath);
      const stateAfter = getFileState(fileUrl);
      if (callback) {
        const oncomplete = callback.oncomplete;
        callback.oncomplete = (error) => {
          if (error) {
            oncomplete.call(callback, error);
          } else {
            oncomplete.call(callback);
            fileDescriptorPathMap.delete(fileDescriptor);
            filesystemStateInfoMap.delete(filePath);
            onWriteFileDone(fileUrl, stateBefore, stateAfter);
          }
        };
        closeSpy.callOriginal();
      } else {
        closeSpy.callOriginal();
        onWriteFileDone(fileUrl, stateBefore, stateAfter);
        fileDescriptorPathMap.delete(fileDescriptor);
        filesystemStateInfoMap.delete(filePath);
      }
    },
  );
  const writeFileUtf8Spy = spyMethod(
    _internalFs,
    "writeFileUtf8",
    (filePath) => {
      const fileUrl = pathToFileURL(filePath);
      const stateBefore = getFileState(fileUrl);
      writeFileUtf8Spy.callOriginal();
      const stateAfter = getFileState(fileUrl);
      onWriteFileDone(fileUrl, stateBefore, stateAfter);
    },
  );
  const unlinkSpy = spyMethod(_internalFs, "unlink", (filePath) => {
    unlinkSpy.callOriginal();
    removeFile(filePath); // TODO eventually split in removeFile/removeDirectory
  });
  restoreCallbackSet.add(() => {
    mkdirSpy.remove();
    openSpy.remove();
    closeSpy.remove();
    writeFileUtf8Spy.remove();
    unlinkSpy.remove();
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
