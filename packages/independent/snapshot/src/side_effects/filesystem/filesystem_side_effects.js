import { readDirectorySync, writeFileSync } from "@jsenv/filesystem";
import { urlIsInsideOf, urlToExtension, urlToRelativeUrl } from "@jsenv/urls";
import { takeDirectorySnapshot } from "../../filesystem_snapshot.js";
import { createWellKnown } from "../../filesystem_well_known_values.js";
import { wrapIntoMarkdownBlock } from "../render_side_effects.js";
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
      const { include, preserve, baseDirectory, outDirectory } =
        filesystemSideEffectsOptions;

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
            getUrlDisplayed,
            outDirectory,
            getToUrl,
            getToUrlDisplayed,
          });
        });
      }
      if (outDirectory) {
        const fsEffectsOutDirectorySnapshot =
          takeDirectorySnapshot(outDirectory);
        const writeFileCallbackSet = new Set();
        addFinallyCallback.add(() => {
          for (const writeFileCallback of writeFileCallbackSet) {
            writeFileCallback();
          }
          writeFileCallbackSet.clear();
          fsEffectsOutDirectorySnapshot.compare();
        });
        writeFile = (url, content) => {
          const { toUrl } = getToUrl(url);
          writeFileCallbackSet.add(() => {
            writeFileSync(toUrl, content);
          });
          addSideEffect({
            type: "fs:write_file",
            value: { url: String(url), content },
            render: {
              md: ({ replace }) => {
                return {
                  label: replace(
                    `write file "${getUrlDisplayed(url)}" (see ${getToUrlDisplayed(toUrl)})`,
                  ),
                };
              },
            },
          });
        };
      } else {
        writeFile = (url, content) => {
          addSideEffect({
            type: "fs:write_file",
            value: { url: String(url), content },
            render: {
              md: ({ replace }) => {
                return {
                  label: replace(`write file "${getUrlDisplayed(url)}"`),
                  text: wrapIntoMarkdownBlock(
                    replace(content, { fileUrl: url }),
                    urlToExtension(url).slice(1),
                  ),
                };
              },
            },
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
              render: {
                md: ({ replace }) => {
                  return {
                    label: replace(`write directory "${getUrlDisplayed(url)}"`),
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
      };
    },
  };
};
