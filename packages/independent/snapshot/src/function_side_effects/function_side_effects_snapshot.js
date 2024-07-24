import { writeFileSync } from "@jsenv/filesystem";
import {
  ensurePathnameTrailingSlash,
  urlToExtension,
  urlToFilename,
  urlToRelativeUrl,
} from "@jsenv/urls";
import { takeDirectorySnapshot } from "../filesystem_snapshot.js";
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
  sideEffectDirectoryRelativeUrl = "./",
  {
    sideEffectFileBasename,
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
  const sideEffectDirectoryUrl = new URL(
    sideEffectDirectoryRelativeUrl,
    fnFileUrl,
  );
  const sideEffectDirectorySnapshot = takeDirectorySnapshot(
    sideEffectDirectoryUrl,
  );
  if (sideEffectFileBasename === undefined) {
    sideEffectFileBasename = `${urlToFilename(sideEffectDirectoryUrl)}_side_effects`;
  }
  const sideEffectFilename = `${sideEffectFileBasename}.md`;
  const sideEffectFileUrl = new URL(sideEffectFilename, sideEffectDirectoryUrl);
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
                  new URL(outDirectory, sideEffectDirectoryUrl),
                );
                const fsEffectsOutDirectoryRelativeUrl = urlToRelativeUrl(
                  fsEffectsOutDirectoryUrl,
                  sideEffectFileUrl,
                );
                writeFile = (url, content) => {
                  const relativeUrl = urlToRelativeUrl(url, fnFileUrl);
                  const toUrl = new URL(relativeUrl, fsEffectsOutDirectoryUrl);
                  callbackSet.add(() => {
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
    writeFileSync(sideEffectFileUrl, renderSideEffects(sideEffects));
    sideEffectDirectorySnapshot.compare();
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
