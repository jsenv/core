import { readDirectorySync, writeFileSync } from "@jsenv/filesystem";
import { urlIsInsideOf, urlToRelativeUrl } from "@jsenv/urls";
import { pathToFileURL } from "node:url";
import { takeDirectorySnapshot } from "../../filesystem_snapshot.js";
import { createWellKnown } from "../../filesystem_well_known_values.js";
import { renderFileContent } from "../render_side_effects.js";
import { groupFileSideEffectsPerDirectory } from "./group_file_side_effects_per_directory.js";
import { spyFilesystemCalls } from "./spy_filesystem_calls.js";

const filesystemSideEffectsOptionsDefault = {
  include: null,
  preserve: false,
  baseDirectory: "",
  outDirectory: "",
};

export const filesystemSideEffects = (
  filesystemSideEffectsOptions,
  { replaceFilesystemWellKnownValues, sideEffectFileUrl },
) => {
  filesystemSideEffectsOptions = {
    ...filesystemSideEffectsOptionsDefault,
    ...filesystemSideEffectsOptions,
  };
  return {
    name: "filesystem",
    install: (addSideEffect, { addFinallyCallback }) => {
      let writeFile;
      let { include, preserve, baseDirectory, outDirectory } =
        filesystemSideEffectsOptions;
      if (outDirectory) {
        outDirectory = new URL(outDirectory, sideEffectFileUrl);
      }

      const getUrlDisplayed = (url) => {
        if (baseDirectory) {
          return urlToRelativeUrl(url, baseDirectory, {
            preferRelativeNotation: true,
          });
        }
        return url;
      };
      const getToUrlDisplayed = (toUrl) => {
        return urlToRelativeUrl(toUrl, sideEffectFileUrl, {
          preferRelativeNotation: true,
        });
      };
      const getToUrl = (url) => {
        if (baseDirectory) {
          if (
            url.href === baseDirectory.href ||
            urlIsInsideOf(url, baseDirectory)
          ) {
            const toRelativeUrl = urlToRelativeUrl(url, baseDirectory);
            return new URL(toRelativeUrl, outDirectory);
          }
        }
        // otherwise we replace the url with well known
        const toRelativeUrl = replaceFilesystemWellKnownValues(url);
        return new URL(toRelativeUrl, outDirectory);
      };

      if (baseDirectory) {
        replaceFilesystemWellKnownValues.addWellKnownFileUrl(
          baseDirectory,
          createWellKnown("base"),
          { position: "start" },
        );
        addFinallyCallback((sideEffects) => {
          // gather all file side effect next to each other
          // collapse them if they have a shared ancestor
          groupFileSideEffectsPerDirectory(sideEffects, {
            createWriteFileGroupSideEffect: (
              fileSideEffectArray,
              commonDirectoryPath,
            ) => {
              return {
                type: "fs:write_file_group",
                value: {},
                render: {
                  md: ({ replace }) => {
                    const numberOfFiles = fileSideEffectArray.length;
                    const commonDirectoryUrl =
                      pathToFileURL(commonDirectoryPath);
                    if (outDirectory) {
                      const commonDirectoryOutUrl =
                        getToUrl(commonDirectoryUrl);
                      const outDirectoryUrlDisplayed = getToUrlDisplayed(
                        commonDirectoryOutUrl,
                      );
                      return {
                        label: `write ${numberOfFiles} files into "${getUrlDisplayed(commonDirectoryUrl)}" (see [${outDirectoryUrlDisplayed}](outDirectoryUrlDisplayed))`,
                      };
                    }

                    const generateInlineFiles = () => {
                      let text = "";
                      for (const fileSideEffect of fileSideEffectArray) {
                        text += `\n${"#".repeat(2)} ${urlToRelativeUrl(
                          fileSideEffect.value.url,
                          commonDirectoryUrl,
                        )}`;
                        text += `\n`;
                        text += renderFileContent(
                          {
                            url: fileSideEffect.value.url,
                            value: fileSideEffect.value.content,
                          },
                          { replace },
                        );
                      }
                      return text;
                    };
                    // const fileGroupValue = {};
                    // fileGroupValue[fileEffect.value.url] = fileEffect.value.content;
                    return {
                      label: `write ${numberOfFiles} files into "${getUrlDisplayed(commonDirectoryUrl)}"`,
                      text: generateInlineFiles(),
                    };
                  },
                },
              };
            },
            getUrlDisplayed,
            outDirectory,
            getToUrl,
            getToUrlDisplayed,
          });
        });
      }
      const writeFileCallbackSet = new Set();
      if (outDirectory) {
        const fsEffectsOutDirectorySnapshot =
          takeDirectorySnapshot(outDirectory);
        addFinallyCallback(() => {
          fsEffectsOutDirectorySnapshot.compare();
        });
        writeFile = (url, content) => {
          const toUrl = getToUrl(url);
          writeFileCallbackSet.add(() => {
            writeFileSync(toUrl, content);
          });
          addSideEffect({
            type: "fs:write_file",
            value: { url: String(url), content },
            render: {
              md: () => {
                const outUrlDisplayed = getToUrlDisplayed(toUrl);
                return {
                  label: `write file "${getUrlDisplayed(url)}" (see [${outUrlDisplayed}](${outUrlDisplayed}))`,
                };
              },
            },
          });
        };
      } else {
        writeFile = (url, content) => {
          const writeFileSideEffect = {
            type: "fs:write_file",
            value: { url: String(url), content },
            render: {
              md: () => {
                return {
                  label: `write file "${getUrlDisplayed(url)}"`,
                  text: {
                    type: "file_content",
                    url,
                    value: writeFileSideEffect.value.content,
                  },
                };
              },
            },
          };
          addSideEffect(writeFileSideEffect);
        };
      }
      const filesystemSpy = spyFilesystemCalls(
        {
          writeFile,
          writeDirectory: (url) => {
            const writeDirectorySideEffect = addSideEffect({
              type: "fs:write_directory",
              value: { url: String(url) },
              render: {
                md: () => {
                  return {
                    label: `write directory "${getUrlDisplayed(url)}"`,
                  };
                },
              },
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
        for (const writeFileCallback of writeFileCallbackSet) {
          writeFileCallback();
        }
        writeFileCallbackSet.clear();
      };
    },
  };
};
