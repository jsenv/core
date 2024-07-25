import { writeFileSync } from "@jsenv/filesystem";
import {
  ensurePathnameTrailingSlash,
  urlToExtension,
  urlToRelativeUrl,
} from "@jsenv/urls";
import {
  takeDirectorySnapshot,
  takeFileSnapshot,
} from "../filesystem_snapshot.js";
import { replaceFluctuatingValues } from "../replace_fluctuating_values.js";
import { collectFunctionSideEffects } from "./function_side_effects_collector.js";
import {
  renderSideEffects,
  wrapIntoMarkdownBlock,
} from "./function_side_effects_renderer.js";
import { spyConsoleCalls } from "./spy_console_calls.js";
import { spyFilesystemCalls } from "./spy_filesystem_calls.js";

const filesystemEffectsDefault = {
  outDirectory: null,
  preserve: false,
};
const consoleEffectsDefault = {
  prevent: true,
};

export const snapshotFunctionSideEffects = (
  fn,
  fnFileUrl,
  sideEffectFileRelativeUrl,
  {
    rootDirectoryUrl = new URL("./", fnFileUrl),
    consoleEffects = true,
    filesystemEffects = true,
  } = {},
) => {
  if (consoleEffects === true) {
    consoleEffects = {};
  }
  if (filesystemEffects === true) {
    filesystemEffects = {};
  }
  const sideEffectFileUrl = new URL(sideEffectFileRelativeUrl, fnFileUrl);
  const sideEffectFileSnapshot = takeFileSnapshot(sideEffectFileUrl);
  const callbackSet = new Set();
  const sideEffectDetectors = [
    ...(consoleEffects
      ? [
          {
            name: "console",
            install: (addSideEffect) => {
              consoleEffects = { ...consoleEffectsDefault, ...consoleEffects };
              const { prevent } = consoleEffects;
              const onConsole = (methodName, message) => {
                addSideEffect({
                  type: `console:${methodName}`,
                  value: message,
                  label: `console.${methodName}`,
                  text: wrapIntoMarkdownBlock(
                    replaceFluctuatingValues(message, {
                      stringType: "console",
                      rootDirectoryUrl,
                    }),
                    "console",
                  ),
                });
              };
              const consoleSpy = spyConsoleCalls(
                {
                  error: (message) => {
                    onConsole("error", message);
                  },
                  warn: (message) => {
                    onConsole("warn", message);
                  },
                  info: (message) => {
                    onConsole("info", message);
                  },
                  log: (message) => {
                    onConsole("log", message);
                  },
                  stdout: (message) => {
                    addSideEffect({
                      type: `process:stdout`,
                      value: message,
                      label: `process.stdout`,
                      text: wrapIntoMarkdownBlock(
                        replaceFluctuatingValues(message, {
                          stringType: "console",
                          rootDirectoryUrl,
                        }),
                        "console",
                      ),
                    });
                  },
                  stderr: (message) => {
                    addSideEffect({
                      type: `process:stderr`,
                      value: message,
                      label: `process.stderr`,
                      text: wrapIntoMarkdownBlock(
                        replaceFluctuatingValues(message, {
                          stringType: "console",
                          rootDirectoryUrl,
                        }),
                        "console",
                      ),
                    });
                  },
                },
                {
                  preventConsoleSideEffects: prevent,
                },
              );
              return () => {
                consoleSpy.restore();
              };
            },
          },
        ]
      : []),
    ...(filesystemEffects
      ? [
          {
            name: "filesystem",
            install: (addSideEffect) => {
              filesystemEffects = {
                ...filesystemEffectsDefault,
                ...filesystemEffects,
              };
              let writeFile;
              const { preserve, outDirectory } = filesystemEffects;
              if (outDirectory) {
                const fsEffectsOutDirectoryUrl = ensurePathnameTrailingSlash(
                  new URL(outDirectory, sideEffectFileUrl),
                );
                const fsEffectsOutDirectorySnapshot = takeDirectorySnapshot(
                  fsEffectsOutDirectoryUrl,
                );
                const fsEffectsOutDirectoryRelativeUrl = urlToRelativeUrl(
                  fsEffectsOutDirectoryUrl,
                  sideEffectFileUrl,
                );
                const writeFileCallbackSet = new Set();
                callbackSet.add(() => {
                  for (const writeFileCallback of writeFileCallbackSet) {
                    writeFileCallback();
                  }
                  writeFileCallbackSet.clear();
                  fsEffectsOutDirectorySnapshot.compare();
                });
                writeFile = (url, content) => {
                  const relativeUrl = urlToRelativeUrl(url, fnFileUrl);
                  const toUrl = new URL(relativeUrl, fsEffectsOutDirectoryUrl);
                  writeFileCallbackSet.add(() => {
                    writeFileSync(toUrl, content);
                  });
                  addSideEffect({
                    type: "fs:write_file",
                    value: { relativeUrl, content },
                    label: `write file "${relativeUrl}" (see ./${fsEffectsOutDirectoryRelativeUrl}${relativeUrl})`,
                    text: null,
                  });
                };
              } else {
                writeFile = (url, content) => {
                  const relativeUrl = urlToRelativeUrl(url, fnFileUrl);
                  addSideEffect({
                    type: "fs:write_file",
                    value: { relativeUrl, content },
                    label: `write file "${relativeUrl}"`,
                    text: wrapIntoMarkdownBlock(
                      content,
                      urlToExtension(url).slice(1),
                    ),
                  });
                };
              }
              const filesystemSpy = spyFilesystemCalls(
                {
                  writeFile,
                  writeDirectory: (url) => {
                    const relativeUrl = urlToRelativeUrl(url, fnFileUrl);
                    addSideEffect({
                      type: "fs:write_directory",
                      value: { relativeUrl },
                      label: `write directory "${relativeUrl}"`,
                      text: null,
                    });
                  },
                },
                {
                  undoFilesystemSideEffects: !preserve,
                },
              );
              return () => {
                filesystemSpy.restore();
              };
            },
          },
        ]
      : []),
  ];
  const onSideEffectsCollected = (sideEffects) => {
    for (const callback of callbackSet) {
      callback();
    }
    callbackSet.clear();
    sideEffectFileSnapshot.update(renderSideEffects(sideEffects), {
      mockFluctuatingValues: false,
    });
  };
  const returnValue = collectFunctionSideEffects(fn, sideEffectDetectors, {
    rootDirectoryUrl,
  });
  if (returnValue && typeof returnValue.then === "function") {
    return returnValue.then((sideEffects) => {
      onSideEffectsCollected(sideEffects);
    });
  }
  onSideEffectsCollected(returnValue);
  return undefined;
};
