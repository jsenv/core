// https://github.com/antfu/fs-spy/blob/main/src/index.ts
// https://github.com/tschaub/mock-fs/tree/main

import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const spyFilesystemCalls = (
  { writeFile = () => {}, removeFile = () => {} },
  { preventFilesystemSideEffects } = {},
) => {
  const _internalFs = process.binding("fs");
  // const openedMap = new Map();
  // const fileDescriptorPathMap = new Map();
  const spies = {
    // open: ({ callOriginal, args }) => {
    //   const [filePath] = args;
    //   openedMap.set(filePath, {});
    //   const fd = callOriginal();
    //   fileDescriptorPathMap.set(fd, filePath);
    //   return fd;
    // },
    // close: ({ callOriginal, args }) => {
    //   const [fileDescriptor] = args;
    //   const filePath = fileDescriptorPathMap.get(fileDescriptor);
    //   if (!filePath) {
    //     return callOriginal();
    //   }
    //   const openInfo = openedMap.get(filePath);
    //   if (!openInfo) {
    //     const returnValue = callOriginal();
    //     fileDescriptorPathMap.delete(fileDescriptor);
    //     return returnValue;
    //   }
    //   writeFile(openInfo);
    //   const returnValue = callOriginal();
    //   fileDescriptorPathMap.delete(fileDescriptor);
    //   openedMap.delete(filePath);
    //   return returnValue;
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
    },
    unlink: removeFile,
  };
  const restoreCallbackSet = new Set();
  for (const methodName of Object.keys(spies)) {
    const spy = spies[methodName];
    const original = _internalFs[methodName];
    if (typeof original !== "function") {
      continue;
    }
    restoreCallbackSet.add(() => {
      _internalFs[methodName] = original;
    });
    let spyExecuting = false;
    _internalFs[methodName] = (...args) => {
      if (spyExecuting) {
        return original(...args);
      }
      spyExecuting = true;
      try {
        return spy({
          callOriginal: () => original(...args),
          args,
        });
      } finally {
        spyExecuting = false;
      }
    };
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

const getFileState = (fileUrl) => {
  try {
    const fileContent = readFileSync(fileUrl);
    const { mtimeMs } = statSync(fileUrl);
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
