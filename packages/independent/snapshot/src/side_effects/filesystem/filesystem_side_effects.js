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
const INLINE_MAX_LINES = 20;
const INLINE_MAX_LENGTH = 2000;

export const filesystemSideEffects = (
  filesystemSideEffectsOptions,
  { replaceFilesystemWellKnownValues },
) => {
  filesystemSideEffectsOptions = {
    ...filesystemSideEffectsOptionsDefault,
    ...filesystemSideEffectsOptions,
  };
  let baseDirectory;
  let removeBaseDirectoryWellKnown = () => {};
  const setBaseDirectory = (value) => {
    removeBaseDirectoryWellKnown();
    baseDirectory = value;
    if (baseDirectory) {
      removeBaseDirectoryWellKnown =
        replaceFilesystemWellKnownValues.addWellKnownFileUrl(
          baseDirectory,
          createWellKnown("base"),
          { position: "start" },
        );
    }
  };

  return {
    name: "filesystem",
    setBaseDirectory,
    install: (addSideEffect, { addSkippableHandler, addFinallyCallback }) => {
      let { include, preserve, textualFilesIntoDirectory } =
        filesystemSideEffectsOptions;
      if (filesystemSideEffectsOptions.baseDirectory) {
        setBaseDirectory(filesystemSideEffectsOptions.baseDirectory);
      }
      const getUrlRelativeToBase = (url) => {
        if (baseDirectory) {
          return urlToRelativeUrl(url, baseDirectory, {
            preferRelativeNotation: true,
          });
        }
        return url;
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

      addSkippableHandler((sideEffect) => {
        // if directory ends up with something inside we'll not report
        // this side effect because:
        // - it was likely created to write the file
        // - the file creation will be reported and implies directory creation
        if (sideEffect.code === "write_directory") {
          return (nextSideEffect, { skip, stop }) => {
            if (
              (nextSideEffect.code === "write_file" ||
                nextSideEffect.code === "write_directory") &&
              urlIsInsideOf(nextSideEffect.value.url, sideEffect.value.url)
            ) {
              skip();
              stop();
              return;
            }
            if (
              nextSideEffect.code === "remove_directory" &&
              nextSideEffect.value.url === sideEffect.value.url
            ) {
              stop();
              return;
            }
          };
        }
        return null;
      });

      addFinallyCallback((sideEffects) => {
        // gather all file side effect next to each other
        // collapse them if they have a shared ancestor
        groupFileSideEffectsPerDirectory(sideEffects, {
          createWriteFileGroupSideEffect: (fileSideEffectArray, commonPath) => {
            let commonUrl = pathToFileURL(commonPath);
            let commonDirectoryUrl;
            if (commonUrl.href.endsWith("/")) {
              commonDirectoryUrl = commonUrl;
            } else {
              commonDirectoryUrl = new URL("./", commonUrl);
            }

            return {
              code: "write_file_group",
              type: `write_file_group ${commonDirectoryUrl}`,
              value: {},
              render: {
                md: (options) => {
                  const numberOfFiles = fileSideEffectArray.length;
                  const generateSideEffectGroup = () => {
                    let groupMd = "";
                    for (const fileSideEffect of fileSideEffectArray) {
                      if (groupMd) {
                        groupMd += "\n\n";
                      }
                      const { url, outDirectoryReason } = fileSideEffect.value;
                      const { text } = fileSideEffect.render.md(options);
                      const relativeUrl = urlToRelativeUrl(
                        url,
                        commonDirectoryUrl,
                      );
                      if (outDirectoryReason) {
                        groupMd += `${"#".repeat(2)} ${relativeUrl}
${renderFileContent(
  { ...text, relativeUrl },
  {
    ...options,
    sideEffect: fileSideEffect,
  },
)}`;
                        continue;
                      }
                      groupMd += `${"#".repeat(2)} ${relativeUrl}
${renderFileContent(
  { ...text, relativeUrl },
  {
    ...options,
    sideEffect: fileSideEffect,
  },
)}`;
                    }
                    return groupMd;
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

      const filesystemSpy = spyFilesystemCalls(
        {
          onWriteFile: (url, buffer) => {
            const contentType = CONTENT_TYPE.fromUrlExtension(url);
            const isTextual = CONTENT_TYPE.isTextual(contentType);
            let outDirectoryReason;
            if (isTextual) {
              if (textualFilesIntoDirectory) {
                outDirectoryReason = "textual_in_directory_option";
              } else if (String(buffer).split("\n").length > INLINE_MAX_LINES) {
                outDirectoryReason = "lot_of_lines";
              } else if (buffer.size > INLINE_MAX_LENGTH) {
                outDirectoryReason = "lot_of_chars";
              }
            } else {
              outDirectoryReason = "binary";
            }
            const writeFileSideEffect = {
              code: "write_file",
              type: `write_file:${url}`,
              value: {
                url,
                buffer,
                contentType,
                isTextual,
                outDirectoryReason,
              },
              render: {
                md: ({ sideEffectFileUrl, outDirectoryUrl }) => {
                  const urlRelativeToBase = getUrlRelativeToBase(url);
                  if (outDirectoryReason) {
                    const urlInsideOutDirectory = getUrlInsideOutDirectory(
                      url,
                      outDirectoryUrl,
                    );
                    if (writeFileSideEffect.counter) {
                      setUrlBasename(
                        urlInsideOutDirectory,
                        (basename) =>
                          `${basename}_${writeFileSideEffect.counter}`,
                      );
                    }
                    let textValue;
                    if (outDirectoryReason === "lot_of_chars") {
                      textValue = String(buffer.slice(0, INLINE_MAX_LENGTH));
                    } else if (outDirectoryReason === "lot_of_lines") {
                      textValue = String(buffer)
                        .split("\n")
                        .slice(0, INLINE_MAX_LINES)
                        .join("\n");
                    } else {
                      textValue = buffer;
                    }
                    return {
                      label: `write file "${urlRelativeToBase}"`,
                      text: {
                        type: "file_content",
                        value: textValue,
                        relativeUrl: urlToRelativeUrl(url, sideEffectFileUrl, {
                          preferRelativeNotation: true,
                        }),
                        urlInsideOutDirectory,
                      },
                    };
                  }
                  return {
                    label: `write file "${urlRelativeToBase}"`,
                    text: {
                      type: "file_content",
                      value: String(buffer),
                    },
                  };
                },
              },
            };
            addSideEffect(writeFileSideEffect);
          },
          onWriteDirectory: (url) => {
            addSideEffect({
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
