export const jsenvPluginHotSearchParam = () => {
  const shouldInjectHotSearchParam = (reference) => {
    if (reference.isImplicit) {
      return false;
    }
    if (reference.data.hotSearchParam) {
      return true;
    }
    if (reference.ownerUrlInfo.data.hotSearchParam) {
      // parent uses hot search param
      return true;
    }
    return false;
  };

  return {
    name: "jsenv:hot_search_param",
    appliesDuring: "dev",
    redirectReference: (reference) => {
      if (!reference.searchParams.has("hot")) {
        reference.data.hotSearchParam = false;
        return null;
      }
      reference.data.hotSearchParam = true;
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
