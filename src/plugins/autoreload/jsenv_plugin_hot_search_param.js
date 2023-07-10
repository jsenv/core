export const jsenvPluginHotSearchParam = () => {
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
      // on veut injecter le param que si modifié
      // sauf si du point de vue du browser il est modifié aussi
      // parce que on a prune son effet
      // donc on veut le re-exec
      if (reference.isImplicit) {
        return null;
      }
      if (reference.original && reference.original.searchParams.has("hot")) {
        return {
          hot: reference.original.searchParams.get("hot"),
        };
      }
      const request = reference.ownerUrlInfo.context.request;
      const parentHotParam = request ? request.searchParams.get("hot") : null;
      if (!parentHotParam) {
        return null;
      }
      // parent is using ?hot -> propagate
      const parentHotTimestamp = Number(parentHotParam);
      const referencedUrlInfo = reference.urlInfo;
      // either it must be modified (and modified since the parent Date.now())
      // or it must have been pruned (in that case we propagate the timestamp)
      if (referencedUrlInfo.modifiedTimestamp >= parentHotTimestamp) {
        return {
          hot: parentHotParam,
        };
      }
      if (referencedUrlInfo.prunedTimestamp >= parentHotTimestamp) {
        return {
          hot: parentHotParam,
        };
      }
      return null;
    },
  };
};
