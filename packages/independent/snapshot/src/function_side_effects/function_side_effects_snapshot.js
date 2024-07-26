import { readDirectorySync, writeFileSync } from "@jsenv/filesystem";
import {
  ensurePathnameTrailingSlash,
  urlToExtension,
  urlToRelativeUrl,
} from "@jsenv/urls";
import { pathToFileURL } from "node:url";
import {
  takeDirectorySnapshot,
  takeFileSnapshot,
} from "../filesystem_snapshot.js";
import {
  createReplaceFilesystemWellKnownValues,
  createWellKnown,
} from "../filesystem_well_known_values.js";
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
  sideEffectFileUrl,
  { consoleEffects = true, filesystemEffects = true, rootDirectoryUrl } = {},
) => {
  if (consoleEffects === true) {
    consoleEffects = {};
  }
  if (filesystemEffects === true) {
    filesystemEffects = {};
  }
  const replaceFilesystemWellKnownValues =
    createReplaceFilesystemWellKnownValues({
      rootDirectoryUrl,
    });
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
                      replaceFilesystemWellKnownValues,
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
                          replaceFilesystemWellKnownValues,
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
                          replaceFilesystemWellKnownValues,
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
              const { include, preserve, baseDirectory, outDirectory } =
                filesystemEffects;
              const fsEffectsBaseDirectoryUrl = baseDirectory
                ? new URL(baseDirectory, sideEffectFileUrl)
                : rootDirectoryUrl
                  ? rootDirectoryUrl
                  : pathToFileURL(process.cwd());
              if (baseDirectory) {
                replaceFilesystemWellKnownValues.addWellKnownFileUrl(
                  baseDirectory,
                  createWellKnown("base"),
                  { position: "start" },
                );
              }
              if (outDirectory) {
                const fsEffectsOutDirectoryUrl = ensurePathnameTrailingSlash(
                  new URL(outDirectory, sideEffectFileUrl),
                );
                const fsEffectsOutDirectorySnapshot = takeDirectorySnapshot(
                  fsEffectsOutDirectoryUrl,
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
                  const relativeUrl = urlToRelativeUrl(
                    url,
                    fsEffectsBaseDirectoryUrl,
                  );
                  const toUrl = new URL(relativeUrl, fsEffectsOutDirectoryUrl);
                  writeFileCallbackSet.add(() => {
                    writeFileSync(toUrl, content);
                  });
                  addSideEffect({
                    type: "fs:write_file",
                    value: { url: String(url), content },
                    label: replaceFluctuatingValues(
                      `write file "${url}" (see ${toUrl})`,
                      { replaceFilesystemWellKnownValues },
                    ),
                    text: null,
                  });
                };
              } else {
                writeFile = (url, content) => {
                  addSideEffect({
                    type: "fs:write_file",
                    value: { url: String(url), content },
                    label: replaceFluctuatingValues(`write file "${url}"`, {
                      replaceFilesystemWellKnownValues,
                    }),
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
                    const writeDirectorySideEffect = addSideEffect({
                      type: "fs:write_directory",
                      value: { url: String(url) },
                      label: replaceFluctuatingValues(
                        `write directory "${url}"`,
                        { replaceFilesystemWellKnownValues },
                      ),
                      text: null,
                    });
                    // if directory ends up with something inside we'll not report
                    // this side effect because:
                    // - it was likely created to write the file
                    // - the file creation will be reported and implies directory creation
                    filesystemSpy.addBeforeUndoCallback(() => {
                      try {
                        const dirContent = readDirectorySync(url);
                        if (dirContent.length) {
                          writeDirectorySideEffect.skippable = true;
                        }
                      } catch (e) {}
                    });
                  },
                },
                {
                  include,
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
