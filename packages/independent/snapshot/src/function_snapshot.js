import { createException } from "@jsenv/exception";
import { writeFileSync } from "@jsenv/filesystem";
import {
  ensurePathnameTrailingSlash,
  urlToFilename,
  urlToRelativeUrl,
} from "@jsenv/urls";
import { takeDirectorySnapshot } from "./filesystem_snapshot.js";
import { replaceFluctuatingValues } from "./replace_fluctuating_values.js";
import { spyConsoleCalls } from "./spy_console_calls.js";
import { spyFilesystemCalls } from "./spy_filesystem_calls.js";

let executing = false;
const RETURN_PROMISE = {};

export const snapshotFunctionSideEffects = (
  fn,
  fnFileUrl,
  sideEffectDirectoryRelativeUrl = "./",
  {
    rootDirectoryUrl = new URL("./", fnFileUrl),
    filesystemEffectsDirectory,
    preventConsoleSideEffects = true,
    undoFilesystemSideEffects = true,
  } = {},
) => {
  if (executing) {
    throw new Error("snapshotFunctionSideEffects already running");
  }
  executing = true;
  if (filesystemEffectsDirectory === true) {
    filesystemEffectsDirectory = "./fs/";
  }
  const sideEffectDirectoryUrl = new URL(
    sideEffectDirectoryRelativeUrl,
    fnFileUrl,
  );
  const sideEffectDirectorySnapshot = takeDirectorySnapshot(
    sideEffectDirectoryUrl,
  );
  const sideEffectFilename = `${urlToFilename(sideEffectDirectoryUrl)}_side_effects.txt`;
  const sideEffectFileUrl = new URL(sideEffectFilename, sideEffectDirectoryUrl);
  const sideEffects = [];
  const finallyCallbackSet = new Set();
  console_side_effects: {
    const onConsole = (methodName, message) => {
      sideEffects.push({
        type: `console.${methodName}`,
        value: message,
      });
    };
    const consoleSpy = spyConsoleCalls(
      {
        error: ({ args }) => {
          onConsole("error", args[0]);
        },
        warn: ({ args }) => {
          onConsole("warn", args[0]);
        },
        info: ({ args }) => {
          onConsole("info", args[0]);
        },
        log: ({ args }) => {
          onConsole("log", args[0]);
        },
      },
      {
        preventConsoleSideEffects,
      },
    );
    finallyCallbackSet.add(() => {
      consoleSpy.restore();
    });
  }
  filesystem_side_effects: {
    const fsSideEffectDirectoryUrl = ensurePathnameTrailingSlash(
      new URL(filesystemEffectsDirectory, sideEffectDirectoryUrl),
    );
    const fsSideEffectsDirectoryRelativeUrl = urlToRelativeUrl(
      fsSideEffectDirectoryUrl,
      sideEffectFileUrl,
    );
    const onFileSystemSideEffect = (fsSideEffect) => {
      if (sideEffects.length) {
        const last = sideEffects.pop();
        sideEffects.push(fsSideEffect);
        sideEffects.push(last);
      } else {
        sideEffects.push(fsSideEffect);
      }
    };
    const filesystemSpy = spyFilesystemCalls(
      {
        writeFile: (url, content) => {
          const relativeUrl = urlToRelativeUrl(url, fnFileUrl);
          const toUrl = new URL(relativeUrl, fsSideEffectDirectoryUrl);
          if (filesystemEffectsDirectory) {
            writeFileSync(toUrl, content);
            onFileSystemSideEffect({
              type: `write file "${relativeUrl}" (see ./${fsSideEffectsDirectoryRelativeUrl}${relativeUrl})`,
              value: content,
            });
          } else {
            onFileSystemSideEffect({
              type: `write file "${relativeUrl}"`,
              value: content,
            });
          }
        },
        writeDirectory: (url) => {
          const relativeUrl = urlToRelativeUrl(url, fnFileUrl);
          onFileSystemSideEffect({
            type: `write directory "${relativeUrl}"`,
          });
        },
      },
      {
        undoFilesystemSideEffects,
      },
    );
    finallyCallbackSet.add(() => {
      filesystemSpy.restore();
    });
  }

  const onCatch = (valueThrow) => {
    sideEffects.push({
      type: "throw",
      value: createException(valueThrow, { rootDirectoryUrl }),
    });
  };
  const onReturn = (valueReturned) => {
    sideEffects.push({
      type: "return",
      value: valueReturned,
    });
  };
  const onResolve = (value) => {
    sideEffects.push({
      type: "resolve",
      value,
    });
  };
  const onReject = (reason) => {
    sideEffects.push({
      type: "reject",
      value: createException(reason, { rootDirectoryUrl }),
    });
  };
  const onFinally = () => {
    executing = false;
    for (const finallyCallback of finallyCallbackSet) {
      finallyCallback();
    }
    writeFileSync(
      sideEffectFileUrl,
      stringifySideEffects(sideEffects, {
        rootDirectoryUrl,
        filesystemEffectsDirectory,
      }),
    );
    sideEffectDirectorySnapshot.compare();
  };

  let returnedPromise = false;
  try {
    const valueReturned = fn();
    if (valueReturned && typeof valueReturned.then === "function") {
      onReturn(RETURN_PROMISE);
      returnedPromise = valueReturned.then(
        (value) => {
          onResolve(value);
          onFinally();
        },
        (e) => {
          onReject(e, true);
          onFinally();
        },
      );
      return returnedPromise;
    }
    onReturn(valueReturned);
    return null;
  } catch (e) {
    onCatch(e);
    return null;
  } finally {
    if (returnedPromise) {
      return returnedPromise;
    }
    onFinally();
  }
};

const stringifySideEffects = (
  sideEffects,
  { rootDirectoryUrl, filesystemEffectsDirectory },
) => {
  let string = "";
  let index = 0;
  for (const sideEffect of sideEffects) {
    if (string) {
      string += "\n\n";
    }
    let label = `${index + 1}. ${sideEffect.type}`;
    let value = sideEffect.value;
    if (sideEffect.type.startsWith("console.")) {
      value = replaceFluctuatingValues(value, {
        stringType: "console",
        rootDirectoryUrl,
      });
    } else if (
      sideEffect.type.startsWith("remove file") ||
      sideEffect.type.startsWith("write file")
    ) {
      if (filesystemEffectsDirectory) {
        value = "";
      }
    } else if (sideEffect.type === "throw") {
      value = renderValueThrownOrRejected(value, { rootDirectoryUrl });
    } else if (sideEffect.type === "return") {
      if (value === RETURN_PROMISE) {
        label = `${index + 1}. return promise`;
        value = "";
      } else {
        value = renderReturnValueOrResolveValue(value, { rootDirectoryUrl });
      }
    } else if (sideEffect.type === "reject") {
      value = renderValueThrownOrRejected(value, { rootDirectoryUrl });
    } else if (sideEffect.type === "resolve") {
      value = renderReturnValueOrResolveValue(value, { rootDirectoryUrl });
    }
    string += label;
    if (value) {
      string += "\n";
      string += value;
    }
    index++;
  }
  return string;
};

// @jsenv/humanize?
const renderReturnValueOrResolveValue = (value, { rootDirectoryUrl }) => {
  if (value === undefined) {
    return "undefined";
  }
  return replaceFluctuatingValues(JSON.stringify(value, null, "  "), {
    stringType: "json",
    rootDirectoryUrl,
  });
};

const renderValueThrownOrRejected = (value, { rootDirectoryUrl }) => {
  return replaceFluctuatingValues(
    value ? value.stack || value.message || value : String(value),
    {
      stringType: "error",
      rootDirectoryUrl,
    },
  );
};
