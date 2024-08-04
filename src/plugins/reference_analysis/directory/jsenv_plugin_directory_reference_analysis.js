import { urlToRelativeUrl } from "@jsenv/urls";

export const jsenvPluginDirectoryReferenceAnalysis = () => {
  return {
    name: "jsenv:directory_reference_analysis",
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
