import { writeFileSync } from "@jsenv/filesystem";
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
                        const urlInsideOutDirectory = getUrlInsideOutDirectory(
                          url,
                          outDirectoryUrl,
                        );
                        if (fileSideEffect.counter) {
                          setUrlBasename(
                            urlInsideOutDirectory,
                            (basename) =>
                              `${basename}_${fileSideEffect.counter}`,
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
                    if (writeFileSideEffect.counter) {
                      setUrlBasename(
                        urlInsideOutDirectory,
                        (basename) =>
                          `${basename}_${writeFileSideEffect.counter}`,
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
