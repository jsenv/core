// - for non textual file content:
//   write them into the out directory (it will default to urlToFilename(sideEffectFile))
//   and an other option like textualFilesIntoOutDirectory = false
// - on mettra les svgs dans out directory
// - on fera toujours un directory snapshot du dossier out
// - écrire des tests ou on log du ansi et voir le svg
// !!! le fait de faire des svgs c'est pas spécifique au filesystem
// donc la logique out directory et snapshot elle remonte dans snapshotSideEffects

import { readDirectorySync, writeFileSync } from "@jsenv/filesystem";
import { setUrlBasename, urlIsInsideOf, urlToRelativeUrl } from "@jsenv/urls";
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
  { replaceFilesystemWellKnownValues },
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
      const getUrlRelativeToBase = (url) => {
        if (baseDirectory) {
          return urlToRelativeUrl(url, baseDirectory, {
            preferRelativeNotation: true,
          });
        }
        return url;
      };
      const getUrlRelativeToOut = (toUrl, outDirectoryUrl) => {
        return urlToRelativeUrl(toUrl, outDirectoryUrl, {
          preferRelativeNotation: true,
        });
      };
      const getUrlInsideOutDirectory = (url, outDirectoryUrl) => {
        if (baseDirectory) {
          if (
            url.href === baseDirectory.href ||
            urlIsInsideOf(url, baseDirectory)
          ) {
            const outRelativeUrl = urlToRelativeUrl(url, baseDirectory);
            return new URL(outRelativeUrl, outDirectoryUrl);
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
              commonPath,
            ) => {
              let commonUrl = pathToFileURL(commonPath);
              let commonDirectoryUrl;
              if (commonUrl.href.endsWith("/")) {
                commonDirectoryUrl = commonUrl;
              } else {
                commonDirectoryUrl = new URL("./", commonUrl);
              }

              return {
                code: "fs:write_file_group",
                type: `fs:write_file_group ${commonDirectoryUrl}`,
                value: {},
                render: {
                  md: ({ replace, sideEffectFileUrl, outDirectoryUrl }) => {
                    const numberOfFiles = fileSideEffectArray.length;
                    const generateSideEffectGroup = () => {
                      let text = "";
                      for (const fileSideEffect of fileSideEffectArray) {
                        if (text) {
                          text += "\n\n";
                        }
                        const { url, willBeInOutDirectory, buffer } =
                          fileSideEffect.value;
                        if (willBeInOutDirectory) {
                          const urlInsideOutDirectory =
                            getUrlInsideOutDirectory(url, outDirectoryUrl);
                          if (fileSideEffect.index) {
                            setUrlBasename(
                              urlInsideOutDirectory,
                              (basename) =>
                                `${basename}_${fileSideEffect.index}`,
                            );
                          }
                          writeFileSync(urlInsideOutDirectory, buffer);
                          const relativeUrl = urlToRelativeUrl(
                            url,
                            commonDirectoryUrl,
                          );
                          const outRelativeUrl = getUrlRelativeToOut(
                            urlInsideOutDirectory,
                            sideEffectFileUrl,
                          );
                          text += `${"#".repeat(2)} [${relativeUrl}](${outRelativeUrl})`;
                          continue;
                        }
                        text += `${"#".repeat(2)} ${urlToRelativeUrl(url, commonDirectoryUrl)}
${renderFileContent(
  {
    url,
    value: String(buffer),
  },
  { replace },
)}`;
                      }
                      return text;
                    };
                    return {
                      label: `write ${numberOfFiles} files into "${getUrlRelativeToBase(commonDirectoryUrl)}"`,
                      text: generateSideEffectGroup(),
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
          onWriteFile: (url, buffer) => {
            const contentType = CONTENT_TYPE.fromUrlExtension(url);
            const isTextual = CONTENT_TYPE.isTextual(contentType);
            const willBeInOutDirectory = isTextual
              ? textualFilesIntoDirectory
              : true;
            const writeFileSideEffect = {
              code: "write_file",
              type: `write_file:${url}`,
              value: {
                url,
                buffer,
                contentType,
                isTextual,
                willBeInOutDirectory,
              },
              render: {
                md: ({ sideEffectFileUrl, outDirectoryUrl }) => {
                  if (willBeInOutDirectory) {
                    const urlInsideOutDirectory = getUrlInsideOutDirectory(
                      url,
                      outDirectoryUrl,
                    );
                    if (writeFileSideEffect.index) {
                      setUrlBasename(
                        urlInsideOutDirectory,
                        (basename) =>
                          `${basename}_${writeFileSideEffect.index}`,
                      );
                    }
                    writeFileSync(urlInsideOutDirectory, buffer);
                    const outRelativeUrl = getUrlRelativeToOut(
                      urlInsideOutDirectory,
                      sideEffectFileUrl,
                    );
                    return {
                      label: `write file ["${getUrlRelativeToBase(url)}"](${outRelativeUrl})`,
                    };
                  }
                  return {
                    label: `write file "${getUrlRelativeToBase(url)}"`,
                    text: {
                      type: "file_content",
                      url,
                      value: String(buffer),
                    },
                  };
                },
              },
            };
            addSideEffect(writeFileSideEffect);
          },
          onWriteDirectory: (url) => {
            const writeDirectorySideEffect = addSideEffect({
              code: "write_directory",
              type: `write_directory:${url}`,
              value: { url },
              render: {
                md: () => {
                  return {
                    label: `write directory "${getUrlRelativeToBase(url)}"`,
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
