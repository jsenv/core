// TODO: allow to add side effect detector
// TODO: a function solely responsible to collect side effects
// this one will use afterwards

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
        type: `console:${methodName}`,
        value: message,
        label: `console.${methodName}`,
        text: replaceFluctuatingValues(message, {
          stringType: "console",
          rootDirectoryUrl,
        }),
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
            finallyCallbackSet.add(() => {
              writeFileSync(toUrl, content);
            });
            onFileSystemSideEffect({
              type: "fs:write_file",
              value: { relativeUrl, content },
              label: `write file "${relativeUrl}" (see ./${fsSideEffectsDirectoryRelativeUrl}${relativeUrl})`,
              text: null,
            });
          } else {
            onFileSystemSideEffect({
              type: "fs:write_file",
              value: { relativeUrl, content },
              label: `write file "${relativeUrl}"`,
              text: content,
            });
          }
        },
        writeDirectory: (url) => {
          const relativeUrl = urlToRelativeUrl(url, fnFileUrl);
          onFileSystemSideEffect({
            type: "fs:write_directory",
            value: { relativeUrl },
            label: `write directory "${relativeUrl}"`,
            text: null,
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
      value: valueThrow,
      label: "throw",
      text: renderValueThrownOrRejected(
        createException(valueThrow, { rootDirectoryUrl }),
        { rootDirectoryUrl },
      ),
    });
  };
  const onReturn = (valueReturned) => {
    if (valueReturned === RETURN_PROMISE) {
      sideEffects.push({
        type: "return",
        value: valueReturned,
        label: "return promise",
        text: null,
      });
    } else {
      sideEffects.push({
        type: "return",
        value: valueReturned,
        label: "return",
        text: renderReturnValueOrResolveValue(valueReturned, {
          rootDirectoryUrl,
        }),
      });
    }
  };
  const onResolve = (value) => {
    sideEffects.push({
      type: "resolve",
      value,
      label: "resolve",
      text: renderReturnValueOrResolveValue(value, { rootDirectoryUrl }),
    });
  };
  const onReject = (reason) => {
    sideEffects.push({
      type: "reject",
      value: reason,
      label: "reject",
      text: renderValueThrownOrRejected(
        createException(reason, { rootDirectoryUrl }),
        { rootDirectoryUrl },
      ),
    });
  };
  const onFinally = () => {
    executing = false;
    for (const finallyCallback of finallyCallbackSet) {
      finallyCallback();
    }
    writeFileSync(sideEffectFileUrl, renderSideEffects(sideEffects));
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

const renderSideEffects = (sideEffects) => {
  let string = "";
  let index = 0;
  for (const sideEffect of sideEffects) {
    if (string) {
      string += "\n\n";
    }
    let label = `${index + 1}. ${sideEffect.label}`;
    let text = sideEffect.text;
    string += label;
    if (text) {
      string += "\n";
      string += text;
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
