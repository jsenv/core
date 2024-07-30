// - for non textual file content:
//   write them into the out directory (it will default to urlToFilename(sideEffectFile))
//   and an other option like textualFilesIntoOutDirectory = false
// - on mettra les svgs dans out directory
// - on fera toujours un directory snapshot du dossier out
// - écrire des tests ou on log du ansi et voir le svg
// !!! le fait de faire des svgs c'est pas spécifique au filesystem
// donc la logique out directory et snapshot elle remonte dans snapshotSideEffects

import { readDirectorySync, writeFileSync } from "@jsenv/filesystem";
import { urlIsInsideOf, urlToRelativeUrl } from "@jsenv/urls";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { pathToFileURL } from "node:url";
import { createWellKnown } from "../../filesystem_well_known_values.js";
import { renderFileContent } from "../render_side_effects.js";
import { groupFileSideEffectsPerDirectory } from "./group_file_side_effects_per_directory.js";
import { spyFilesystemCalls } from "./spy_filesystem_calls.js";

const filesystemSideEffectsOptionsDefault = {
  include: null,
  preserve: false,
  baseDirectory: "",
  textualFilesIntoDirectory: false,
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
      let { include, preserve, baseDirectory, textualFilesIntoDirectory } =
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
      const getToUrl = (url, outDirectoryUrl) => {
        if (baseDirectory) {
          if (
            url.href === baseDirectory.href ||
            urlIsInsideOf(url, baseDirectory)
          ) {
            const toRelativeUrl = urlToRelativeUrl(url, baseDirectory);
            return new URL(toRelativeUrl, outDirectoryUrl);
          }
        }
        // otherwise we replace the url with well known
        const toRelativeUrl = replaceFilesystemWellKnownValues(url);
        return new URL(toRelativeUrl, outDirectoryUrl);
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
                  md: ({ replace, outDirectoryUrl }) => {
                    const numberOfFiles = fileSideEffectArray.length;
                    const commonDirectoryUrl =
                      pathToFileURL(commonDirectoryPath);
                    const generateInlineFiles = () => {
                      let text = "";
                      for (const fileSideEffect of fileSideEffectArray) {
                        const { url, willBeInOutDirectory, content } =
                          fileSideEffect.value;
                        if (willBeInOutDirectory) {
                          const toUrl = getToUrl(url, outDirectoryUrl);
                          writeFileSync(toUrl, content);
                          const outUrlDisplayed = getToUrlDisplayed(toUrl);
                          text += `
${"#".repeat(2)} ${urlToRelativeUrl(url, commonDirectoryUrl)} (see [${outUrlDisplayed}](${outUrlDisplayed}))`;
                          continue;
                        }
                        text += `
${"#".repeat(2)} ${urlToRelativeUrl(url, commonDirectoryUrl)}
${renderFileContent(
  {
    url: fileSideEffect.value.url,
    value: fileSideEffect.value.content,
  },
  { replace },
)}`;
                      }
                      return text;
                    };
                    return {
                      label: `write ${numberOfFiles} files into "${getUrlDisplayed(commonDirectoryUrl)}"`,
                      text: generateInlineFiles(),
                    };
                  },
                },
              };
            },
          });
        });
      }
      const filesystemSpy = spyFilesystemCalls(
        {
          writeFile: (url, content) => {
            const contentType = CONTENT_TYPE.fromUrlExtension(url);
            const isTextual = CONTENT_TYPE.isTextual(contentType);
            const willBeInOutDirectory = isTextual
              ? textualFilesIntoDirectory
              : true;
            const writeFileSideEffect = {
              type: "fs:write_file",
              value: {
                url: String(url),
                content,
                contentType,
                isTextual,
                willBeInOutDirectory,
              },
              render: {
                md: ({ outDirectoryUrl }) => {
                  if (willBeInOutDirectory) {
                    const toUrl = getToUrl(url, outDirectoryUrl);
                    writeFileSync(toUrl, content);
                    const outUrlDisplayed = getToUrlDisplayed(toUrl);
                    return {
                      label: `write file "${getUrlDisplayed(url)}" (see [${outUrlDisplayed}](${outUrlDisplayed}))`,
                    };
                  }
                  return {
                    label: `write file "${getUrlDisplayed(url)}"`,
                    text: {
                      type: "file_content",
                      url,
                      value: content,
                    },
                  };
                },
              },
            };
            addSideEffect(writeFileSideEffect);
          },
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
      };
    },
  };
};
