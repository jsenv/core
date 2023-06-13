import { urlToRelativeUrl } from "@jsenv/urls";

export const jsenvPluginDirectoryReferenceAnalysis = () => {
  return {
    name: "jsenv:directory_reference_analysis",
    transformUrlContent: {
      directory: (urlInfo, context) => {
        const originalDirectoryReference = findOriginalDirectoryReference(
          urlInfo,
          context,
        );
        const directoryRelativeUrl = urlToRelativeUrl(
          urlInfo.url,
          context.rootDirectoryUrl,
        );
        JSON.parse(urlInfo.content).forEach((directoryEntryName) => {
          urlInfo.references.found({
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

const findOriginalDirectoryReference = (urlInfo, context) => {
  const findNonFileSystemAncestor = (urlInfo) => {
    for (const dependentUrl of urlInfo.dependents) {
      const dependentUrlInfo = context.urlGraph.getUrlInfo(dependentUrl);
      if (dependentUrlInfo.type !== "directory") {
        return [dependentUrlInfo, urlInfo];
      }
      const found = findNonFileSystemAncestor(dependentUrlInfo);
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
  const ref = ancestor.references.find((ref) => ref.url === child.url);
  return ref;
};
