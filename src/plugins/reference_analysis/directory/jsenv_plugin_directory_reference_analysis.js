import { urlToRelativeUrl } from "@jsenv/urls";

export const jsenvPluginDirectoryReferenceAnalysis = () => {
  return {
    name: "jsenv:directory_reference_analysis",
    transformUrlContent: {
      directory: async (urlInfo) => {
        const originalDirectoryReference =
          findOriginalDirectoryReference(urlInfo);
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
          await entryReference.readGeneratedSpecifier();
          const replacement = entryReference.generatedSpecifier;
          newEntryNames.push(replacement);
        }
        return JSON.stringify(newEntryNames);
      },
    },
  };
};

const findOriginalDirectoryReference = (urlInfo) => {
  const findNonFileSystemAncestor = (urlInfo) => {
    for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
      const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
      if (urlInfoReferencingThisOne.type !== "directory") {
        return referenceFromOther;
      }
      const found = findNonFileSystemAncestor(urlInfoReferencingThisOne);
      if (found) {
        return found;
      }
    }
    return null;
  };
  return findNonFileSystemAncestor(urlInfo);
};
