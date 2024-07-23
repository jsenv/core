import { readEntryStatSync, readFileSync } from "@jsenv/filesystem";
import { urlToRelativeUrl } from "@jsenv/urls/src/url_to_relative_url.js";
import { takeFileSnapshot } from "./filesystem_snapshot.js";
import { replaceFluctuatingValues } from "./replace_fluctuating_values.js";

export const snapshotFunctionSideEffects = (
  fn,
  fnFileUrl,
  sideEffectFileRelativeUrl,
  {
    rootDirectoryUrl = new URL("./", fnFileUrl),
    captureConsole = true,
    filesystemEffects,
  } = {},
) => {
  const sideEffectFileUrl = new URL(sideEffectFileRelativeUrl, fnFileUrl);
  const sideEffectFileSnapshot = takeFileSnapshot(sideEffectFileUrl);
  const sideEffects = [];
  const finallyCallbackSet = new Set();
  const onError = (e) => {
    sideEffects.push({
      type: "throw",
      value: e,
    });
  };
  const onResult = (result) => {
    sideEffects.push({
      type: "return",
      value: result,
    });
  };
  const onFinally = () => {
    for (const finallyCallback of finallyCallbackSet) {
      finallyCallback();
    }
    sideEffectFileSnapshot.update(
      stringifySideEffects(sideEffects, { rootDirectoryUrl }),
    );
    sideEffectFileSnapshot.compare();
  };
  if (captureConsole) {
    const installConsoleSpy = (methodName) => {
      const methodSpied = console[methodName];
      console[methodName] = (message) => {
        sideEffects.push({
          type: `console.${methodName}`,
          value: message,
        });
      };
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
    for (const filesystemEffect of filesystemEffects) {
      const from = new URL(filesystemEffect, fnFileUrl);
      const relativeUrl = urlToRelativeUrl(from, fnFileUrl);
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
          onFileSystemSideEffect({
            type: `write file "${relativeUrl}"`,
            value: nowState.content,
          });
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
      returnedPromise = true;
      returnValue.then(
        (value) => {
          onResult(value);
          onFinally();
        },
        (e) => {
          onError(e);
          onFinally();
        },
      );
    } else {
      onResult(returnValue);
    }
  } catch (e) {
    onError(e);
  } finally {
    if (returnedPromise) {
      return;
    }
    onFinally();
  }
};

const stringifySideEffects = (sideEffects, { rootDirectoryUrl }) => {
  let string = "";
  let index = 0;
  for (const sideEffect of sideEffects) {
    if (string) {
      string += "\n\n";
    }
    string += `${index + 1}. ${sideEffect.type}`;
    string += "\n";
    let value = sideEffect.value;
    if (sideEffect.type === "throw") {
      value = replaceFluctuatingValues(value.stack, {
        stringType: "error",
      });
    } else if (sideEffect.type === "return") {
      value =
        value === undefined
          ? undefined
          : replaceFluctuatingValues(JSON.stringify(value, null, "  "), {
              stringType: "json",
              rootDirectoryUrl,
            });
    } else if (sideEffect.type.startsWith("console.")) {
      value = replaceFluctuatingValues(value, {
        stringType: "console",
        rootDirectoryUrl,
      });
    }
    string += value;
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
