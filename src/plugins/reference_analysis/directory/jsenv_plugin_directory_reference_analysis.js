import { urlToFilename, urlToRelativeUrl } from "@jsenv/urls";

export const jsenvPluginDirectoryReferenceAnalysis = ({
  directoryReferenceEffect = "error",
}) => {
  return {
    name: "jsenv:directory_reference_analysis",
    redirectReference: (reference) => {
      if (reference.ownerUrlInfo.type === "directory") {
        reference.dirnameHint = reference.ownerUrlInfo.filenameHint;
      }

      const { pathname } = new URL(reference.url);
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      if (pathname[pathname.length - 1] !== "/") {
        return null;
      }
      if (reference.type === "filesystem") {
        reference.filenameHint = `${
          reference.ownerUrlInfo.filenameHint
        }${urlToFilename(reference.url)}/`;
      } else {
        reference.filenameHint = `${urlToFilename(reference.url)}/`;
      }

      reference.expectedType = "directory";
      // we know we are referencing a directory, now what?
      if (reference.type === "a_href") {
        reference.actionForDirectory = "ignore";
        reference.isWeak = true;
        return null;
      }
      if (reference.type === "filesystem") {
        reference.actionForDirectory = "copy";
        return null;
      }
      let actionForDirectory;
      if (typeof directoryReferenceEffect === "string") {
        actionForDirectory = directoryReferenceEffect;
      } else if (typeof directoryReferenceEffect === "function") {
        actionForDirectory = directoryReferenceEffect(reference);
      } else {
        actionForDirectory = "error";
      }
      reference.actionForDirectory = actionForDirectory;
      if (actionForDirectory !== "copy") {
        reference.isWeak = true;
      }
      if (actionForDirectory === "error") {
        const error = new Error("Reference leads to a directory");
        error.code = "DIRECTORY_REFERENCE_NOT_ALLOWED";
        throw error;
      }
      if (actionForDirectory === "preserve") {
        return `ignore:${reference.specifier}`;
      }
      return null;
    },
    transformUrlContent: {
      directory: async (urlInfo) => {
        if (urlInfo.contentType !== "application/json") {
          return null;
        }
        if (urlInfo.context.dev) {
          return null;
        }
        const isShapeBuildStep = urlInfo.kitchen.context.buildStep === "shape";
        let originalDirectoryReference;
        if (isShapeBuildStep) {
          originalDirectoryReference = urlInfo.firstReference;
        } else {
          let firstReferenceCopy = urlInfo.firstReference;
          originalDirectoryReference =
            findOriginalDirectoryReference(firstReferenceCopy);
        }
        const directoryRelativeUrl = urlToRelativeUrl(
          urlInfo.url,
          urlInfo.context.rootDirectoryUrl,
        );
        const entryNames = JSON.parse(urlInfo.content);
        const newEntryNames = [];
        for (const entryName of entryNames) {
          const entryReference = urlInfo.dependencies.found({
            type: "filesystem",
            subtype: "directory_entry",
            specifier: entryName,
            trace: {
              message: `"${directoryRelativeUrl}${entryName}" entry in directory referenced by ${originalDirectoryReference.trace.message}`,
            },
          });
          entryReference.actionForDirectory = "copy";
          await entryReference.readGeneratedSpecifier();
          const replacement = entryReference.generatedSpecifier;
          newEntryNames.push(replacement);
        }
        return JSON.stringify(newEntryNames);
      },
    },
  };
};

const findOriginalDirectoryReference = (firstReferenceAskingCopy) => {
  const findNonFileSystemAncestor = (urlInfo) => {
    for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
      if (referenceFromOther.type !== "filesystem") {
        return referenceFromOther;
      }
      return findNonFileSystemAncestor(referenceFromOther.ownerUrlInfo);
    }
    return null;
  };
  if (firstReferenceAskingCopy.type !== "filesystem") {
    return firstReferenceAskingCopy;
  }
  return findNonFileSystemAncestor(firstReferenceAskingCopy.ownerUrlInfo);
};
