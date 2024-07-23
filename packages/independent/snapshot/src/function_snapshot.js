import {
  readEntryStatSync,
  readFileSync,
  removeFileSync,
  writeFileSync,
} from "@jsenv/filesystem";
import {
  ensurePathnameTrailingSlash,
  urlToFilename,
  urlToRelativeUrl,
} from "@jsenv/urls";
import { pathToFileURL } from "node:url";
import { takeDirectorySnapshot } from "./filesystem_snapshot.js";
import { replaceFluctuatingValues } from "./replace_fluctuating_values.js";
import { spyConsoleCalls } from "./spy_console_calls.js";
import { spyFilesystemCalls } from "./spy_filesystem_calls.js";

let executing = false;

export const snapshotFunctionSideEffects = (
  fn,
  fnFileUrl,
  sideEffectDirectoryRelativeUrl = "./",
  {
    rootDirectoryUrl = new URL("./", fnFileUrl),
    filesystemEffectsDirectory,
    restoreFilesystem = true,
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
    const consoleSpy = spyConsoleCalls({
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
    });
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
    const filesystemSpy = spyFilesystemCalls({
      writeFile: ({ callOriginal, args }) => {
        const [filePath] = args;
        const fileUrl = pathToFileURL(filePath);
        const relativeUrl = urlToRelativeUrl(fileUrl, fnFileUrl);
        const toUrl = new URL(relativeUrl, fsSideEffectDirectoryUrl);
        const currentState = getFileState(fileUrl);
        callOriginal();
        const nowState = getFileState(fileUrl);
        // we use same type because we don't want to differentiate between
        // - writing file for the 1st time
        // - updating file content
        // the important part is the file content in the end of the function execution
        if (
          (!currentState.found && nowState.found) ||
          currentState.content !== nowState.content ||
          currentState.mtimeMs !== nowState.mtimeMs
        ) {
          if (filesystemEffectsDirectory) {
            writeFileSync(toUrl, nowState.content);
            onFileSystemSideEffect({
              type: `write file "${relativeUrl}" (see ./${fsSideEffectsDirectoryRelativeUrl}${relativeUrl})`,
              value: nowState.content,
            });
          } else {
            onFileSystemSideEffect({
              type: `write file "${relativeUrl}"`,
              value: nowState.content,
            });
          }
          if (restoreFilesystem) {
            if (currentState.found) {
              if (currentState.content !== nowState.content) {
                writeFileSync(fileUrl, currentState.content);
              }
            } else {
              removeFileSync(fileUrl);
            }
          }
          return;
        }
        // file is exactly the same
        // function did not have any effect on the file
      },
    });
    finallyCallbackSet.add(() => {
      filesystemSpy.restore();
    });
  }

  const onError = (e, isAsync) => {
    sideEffects.push({
      type: isAsync ? "reject" : "throw",
      value: e,
    });
  };
  const onResult = (result, isAsync) => {
    sideEffects.push({
      type: isAsync ? "resolve" : "return",
      value: result,
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
    const returnValue = fn();
    if (returnValue && returnValue.then) {
      returnedPromise = returnValue.then(
        (value) => {
          onResult(value, true);
          onFinally();
        },
        (e) => {
          onError(e, true);
          onFinally();
        },
      );
      return returnedPromise;
    }
    onResult(returnValue);
    return null;
  } catch (e) {
    onError(e);
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
    string += `${index + 1}. ${sideEffect.type}`;
    let value = sideEffect.value;
    if (sideEffect.type.startsWith("console.")) {
      value = replaceFluctuatingValues(value, {
        stringType: "console",
        rootDirectoryUrl,
      });
      string += "\n";
      string += value;
    } else if (
      sideEffect.type.startsWith("remove file") ||
      sideEffect.type.startsWith("write file")
    ) {
      if (!filesystemEffectsDirectory) {
        string += "\n";
        string += value;
      }
    } else if (sideEffect.type === "throw" || sideEffect.type === "reject") {
      value = replaceFluctuatingValues(value.stack, {
        stringType: "error",
      });
      string += "\n";
      string += value;
    } else if (sideEffect.type === "return" || sideEffect.type === "resolve") {
      value =
        value === undefined
          ? undefined
          : replaceFluctuatingValues(JSON.stringify(value, null, "  "), {
              stringType: "json",
              rootDirectoryUrl,
            });
      string += "\n";
      string += value;
    } else {
      string += "\n";
      string += value;
    }
    index++;
  }
  return string;
};

const getFileState = (fileUrl) => {
  try {
    const fileContent = readFileSync(fileUrl);
    const { mtimeMs } = readEntryStatSync(fileUrl);
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
