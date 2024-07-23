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
import { takeDirectorySnapshot } from "./filesystem_snapshot.js";
import { replaceFluctuatingValues } from "./replace_fluctuating_values.js";

const consoleSpySymbol = Symbol.for("console_spy_for_jsenv_snapshot");

export const snapshotFunctionSideEffects = (
  fn,
  fnFileUrl,
  sideEffectDirectoryRelativeUrl = "./",
  {
    rootDirectoryUrl = new URL("./", fnFileUrl),
    captureConsole = true,
    filesystemEffects,
    filesystemEffectsDirectory,
    restoreFilesystem = true,
  } = {},
) => {
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
  if (captureConsole) {
    const installConsoleSpy = (methodName) => {
      const methodSpied = console[methodName];
      if (consoleSpySymbol in methodSpied) {
        throw new Error("snapshotFunctionSideEffects already running");
      }
      const methodSpy = (message) => {
        sideEffects.push({
          type: `console.${methodName}`,
          value: message,
        });
      };
      methodSpy[consoleSpySymbol] = true;
      console[methodName] = methodSpy;
      finallyCallbackSet.add(() => {
        console[methodName] = methodSpied;
      });
    };
    installConsoleSpy("error");
    installConsoleSpy("warn");
    installConsoleSpy("info");
    installConsoleSpy("log");
  }
  if (filesystemEffects) {
    const fsSideEffectDirectoryUrl = ensurePathnameTrailingSlash(
      new URL(filesystemEffectsDirectory, sideEffectDirectoryUrl),
    );
    const fsSideEffectsDirectoryRelativeUrl = urlToRelativeUrl(
      fsSideEffectDirectoryUrl,
      sideEffectFileUrl,
    );
    for (const filesystemEffect of filesystemEffects) {
      const from = new URL(filesystemEffect, fnFileUrl);
      const relativeUrl = urlToRelativeUrl(from, fnFileUrl);
      const toUrl = new URL(relativeUrl, fsSideEffectDirectoryUrl);
      const atStartState = getFileState(from);
      const onFileSystemSideEffect = (fsSideEffect) => {
        const last = sideEffects.pop();
        sideEffects.push(fsSideEffect);
        sideEffects.push(last);
      };
      finallyCallbackSet.add(() => {
        const nowState = getFileState(from);
        if (atStartState.found && !nowState.found) {
          onFileSystemSideEffect({
            type: `remove file "${relativeUrl}"`,
            value: atStartState.content,
          });
          if (restoreFilesystem) {
            writeFileSync(from, atStartState.content);
          }
          return;
        }
        // we use same type because we don't want to differentiate between
        // - writing file for the 1st time
        // - updating file content
        // the important part is the file content in the end of the function execution
        if (
          (!atStartState.found && nowState.found) ||
          atStartState.content !== nowState.content ||
          atStartState.mtimeMs !== nowState.mtimeMs
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
            if (atStartState.found) {
              if (atStartState.content !== nowState.content) {
                writeFileSync(from, atStartState.content);
              }
            } else {
              removeFileSync(from);
            }
          }
          return;
        }
        // file is exactly the same
        // function did not have any effect on the file
      });
    }
  }
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
