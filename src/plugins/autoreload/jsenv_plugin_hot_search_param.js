export const jsenvPluginHotSearchParam = () => {
  const shouldInjectHotSearchParam = (reference) => {
    if (reference.isImplicit) {
      return false;
    }
    if (reference.original && reference.original.searchParams.has("hot")) {
      return true;
    }
    // parent is using ?hot -> propagate
    const { ownerUrlInfo } = reference;
    const lastReference = ownerUrlInfo.context.reference;
    if (
      lastReference &&
      lastReference.original &&
      lastReference.original.searchParams.has("hot")
    ) {
      return true;
    }
    return false;
  };

  return {
    name: "jsenv:hot_search_param",
    appliesDuring: "dev",
    redirectReference: (reference) => {
      if (!reference.searchParams.has("hot")) {
        return null;
      }
      const urlObject = new URL(reference.url);
      // "hot" search param goal is to invalide url in browser cache:
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      urlObject.searchParams.delete("hot");
      urlObject.searchParams.delete("v");
      return urlObject.href;
    },
    transformReferenceSearchParams: (reference) => {
      if (!shouldInjectHotSearchParam(reference)) {
        return null;
      }
      const referencedUrlInfo = reference.urlInfo;
      if (!referencedUrlInfo.modifiedTimestamp) {
        return null;
      }
      return {
        hot: "",
        v: referencedUrlInfo.modifiedTimestamp,
      };
    },
  };
};
