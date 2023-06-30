import { urlToRelativeUrl } from "@jsenv/urls";

export const jsenvPluginDirectoryReferenceAnalysis = () => {
  return {
    name: "jsenv:directory_reference_analysis",
    transformUrlContent: {
      directory: (urlInfo, context) => {
        const originalDirectoryReference =
          findOriginalDirectoryReference(urlInfo);
        const directoryRelativeUrl = urlToRelativeUrl(
          urlInfo.url,
          context.rootDirectoryUrl,
        );
        JSON.parse(urlInfo.content).forEach((directoryEntryName) => {
          urlInfo.dependencies.found({
            type: "filesystem",
            subtype: "directory_entry",
            specifier: directoryEntryName,
            trace: {
              message: `"${directoryRelativeUrl}${directoryEntryName}" entry in directory referenced by ${originalDirectoryReference.trace.message}`,
            },
          });
        });
      },
    },
  };
};

const findOriginalDirectoryReference = (urlInfo) => {
  const findNonFileSystemAncestor = (urlInfo) => {
    for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
      const urlInfoReferencingThisOne = referenceFromOther.ownerUrlInfo;
      if (urlInfoReferencingThisOne.type !== "directory") {
        return urlInfoReferencingThisOne;
      }
      const found = findNonFileSystemAncestor(urlInfoReferencingThisOne);
      if (found) {
        return found;
      }
    }
    return [];
  };
  const [ancestor, child] = findNonFileSystemAncestor(urlInfo);
  if (!ancestor) {
    return null;
  }
  for (const referenceToOther of ancestor.referenceToOthersSet) {
    if (referenceToOther.url === child.url) {
      return referenceToOther;
    }
  }
  return null;
};
