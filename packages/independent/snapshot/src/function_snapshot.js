import {
  moveEntrySync,
  writeDirectorySync,
  writeFileSync,
} from "@jsenv/filesystem";
import { urlToRelativeUrl } from "@jsenv/urls/src/url_to_relative_url.js";
import { takeDirectorySnapshot } from "./filesystem_snapshot.js";
import { replaceFluctuatingValues } from "./replace_fluctuating_values.js";

export const snapshotFunctionSideEffects = (
  fn,
  fnFileUrl,
  {
    sideEffectDirectoryName = "output",
    rootDirectoryUrl = new URL("./", fnFileUrl),
    captureConsole = true,
    filesystemRedirects,
  } = {},
) => {
  const sideEffectDirectoryUrl = new URL(sideEffectDirectoryName, fnFileUrl);
  writeDirectorySync(sideEffectDirectoryUrl, { allowUseless: true });
  const sideEffectDirectorySnapshot = takeDirectorySnapshot(
    sideEffectDirectoryUrl,
  );
  const finallyCallbackSet = new Set();
  const errorFileUrl = new URL("./error.txt", sideEffectDirectoryUrl);
  const resultFileUrl = new URL("./result.json", sideEffectDirectoryUrl);
  const onError = (e) => {
    writeFileSync(
      errorFileUrl,
      replaceFluctuatingValues(e.stack, {
        fileUrl: errorFileUrl,
      }),
    );
  };
  const onResult = (result) => {
    if (result === undefined) {
      return;
    }
    writeFileSync(
      resultFileUrl,
      replaceFluctuatingValues(JSON.stringify(result, null, "  "), {
        fileUrl: resultFileUrl,
        rootDirectoryUrl,
      }),
    );
  };
  const onFinally = () => {
    for (const finallyCallback of finallyCallbackSet) {
      finallyCallback();
    }
    sideEffectDirectorySnapshot.compare();
  };
  if (captureConsole) {
    const installConsoleSpy = (methodName, consoleOutputFileUrl) => {
      const methodSpied = console[methodName];
      let output = "";
      console[methodName] = (message) => {
        if (output) {
          output += "\n";
        }
        output += message;
      };
      finallyCallbackSet.add(() => {
        console[methodName] = methodSpied;
        if (output) {
          writeFileSync(
            consoleOutputFileUrl,
            replaceFluctuatingValues(output, {
              fileUrl: consoleOutputFileUrl,
              rootDirectoryUrl,
            }),
          );
        }
      });
    };
    installConsoleSpy(
      "error",
      new URL("./console_errors.txt", sideEffectDirectoryUrl),
    );
    installConsoleSpy(
      "warn",
      new URL("./console_warnings.txt", sideEffectDirectoryUrl),
    );
    installConsoleSpy(
      "info",
      new URL("./console_infos.txt", sideEffectDirectoryUrl),
    );
    installConsoleSpy(
      "log",
      new URL("./console_logs.txt", sideEffectDirectoryUrl),
    );
  }
  if (filesystemRedirects) {
    const filesystemEffectDirectoryUrl = new URL(
      "./fs/",
      sideEffectDirectoryUrl,
    );
    for (const filesystemRedirect of filesystemRedirects) {
      finallyCallbackSet.add(() => {
        const from = new URL(filesystemRedirect, fnFileUrl);
        const relativeUrl = urlToRelativeUrl(from, fnFileUrl);
        moveEntrySync({
          from,
          to: new URL(relativeUrl, filesystemEffectDirectoryUrl),
          noEntryEffect: "none",
          overwrite: true,
        });
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
