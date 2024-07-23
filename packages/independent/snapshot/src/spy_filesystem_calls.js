// https://github.com/antfu/fs-spy/blob/main/src/index.ts
// https://github.com/tschaub/mock-fs/tree/main

import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { spyMethod } from "./spy_method.js";

export const spyFilesystemCalls = (
  { writeFile = () => {}, removeFile = () => {} },
  { preventFilesystemSideEffects } = {},
) => {
  const _internalFs = process.binding("fs");
  const openFileInfoMap = new Map();
  const fileDescriptorPathMap = new Map();

  const onWriteFileDone = (fileUrl, currentState, nowState) => {
    // we use same type because we don't want to differentiate between
    // - writing file for the 1st time
    // - updating file content
    // the important part is the file content in the end of the function execution
    if (
      (!currentState.found && nowState.found) ||
      currentState.content !== nowState.content ||
      currentState.mtimeMs !== nowState.mtimeMs
    ) {
      writeFile(fileUrl, nowState.content);
      return;
    }
    // file is exactly the same
    // function did not have any effect on the file
  };
  const spies = {
    open: ({ callOriginal, args }) => {
      // prettier-ignore
      const [
        filePath, 
        /* flags */,
        /* mode */,
        callback,
      ] = args;
      if (callback) {
        const oncomplete = callback.oncomplete;
        callback.oncomplete = (error, fd) => {
          if (error) {
            oncomplete(error);
          } else {
            fileDescriptorPathMap.set(fd, filePath);
            const currentState = getFileState(filePath);
            openFileInfoMap.set(filePath, currentState);
            oncomplete(error, fd);
          }
        };
        return callOriginal();
      }
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
      const openInfo = openFileInfoMap.get(filePath);
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
      openFileInfoMap.delete(filePath);
      return returnValue;
    },
    // writeBuffer: ({ callOriginal, args }) => {
    //   const [filePath] = args;
    //   debugger;
    // },
    writeFileUtf8: ({ callOriginal, args }) => {
      const [filePath] = args;
      const fileUrl = pathToFileURL(filePath);
      const currentState = getFileState(fileUrl);
      let nowState;
      if (preventFilesystemSideEffects) {
        const content = args[1];
        nowState = {
          found: true,
          content,
        };
      } else {
        callOriginal();
        nowState = getFileState(fileUrl);
      }
      onWriteFileDone(fileUrl, currentState, nowState);
    },
    unlink: removeFile,
  };
  const restoreCallbackSet = new Set();
  for (const methodName of Object.keys(spies)) {
    const spy = spies[methodName];
    const unspy = spyMethod(_internalFs, methodName, spy, {
      preventCallToOriginal: true,
    });
    restoreCallbackSet.add(() => {
      unspy();
    });
  }
  return {
    restore: () => {
      for (const restoreCallback of restoreCallbackSet) {
        restoreCallback();
      }
      restoreCallbackSet.clear();
    },
  };
};

const getFileState = (fileUrlOrFileDescriptor) => {
  try {
    const fileContent = readFileSync(fileUrlOrFileDescriptor);
    const { mtimeMs } = statSync(fileUrlOrFileDescriptor);
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
