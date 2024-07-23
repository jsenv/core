// https://github.com/antfu/fs-spy/blob/main/src/index.ts
// https://github.com/tschaub/mock-fs/tree/main

export const spyFilesystemCalls = ({
  writeFile = () => {},
  removeFile = () => {},
}) => {
  const _internalFs = process.binding("fs");
  const spies = {
    writeFileUtf8: writeFile,
    unlink: removeFile,
  };
  const restoreCallbackSet = new Set();
  for (const method of Object.keys(spies)) {
    const spy = spies[method];
    const original = _internalFs[method];
    if (typeof original !== "function") {
      continue;
    }
    restoreCallbackSet.add(() => {
      _internalFs[method] = original;
    });
    let spyExecuting = false;
    _internalFs[method] = (...args) => {
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
