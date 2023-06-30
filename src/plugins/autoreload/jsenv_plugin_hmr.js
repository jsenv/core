export const jsenvPluginHmr = () => {
  const shouldInjectHmr = (reference) => {
    if (reference.isImplicit) {
      return false;
    }
    if (reference.data.hmr) {
      return true;
    }
    if (reference.ownerUrlInfo.data.hmr) {
      // parent uses hmr search param
      return true;
    }
    return false;
  };

  return {
    name: "jsenv:hmr",
    appliesDuring: "dev",
    redirectReference: (reference) => {
      if (!reference.searchParams.has("hmr")) {
        reference.data.hmr = false;
        return null;
      }
      reference.data.hmr = true;
      const urlObject = new URL(reference.url);
      // "hmr" search param goal is to mark url as enabling hmr:
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      urlObject.searchParams.delete("hmr");
      urlObject.searchParams.delete("v");
      return urlObject.href;
    },
    transformReferenceSearchParams: (reference) => {
      if (!shouldInjectHmr(reference)) {
        return null;
      }
      const referencedUrlInfo = reference.urlInfo;
      if (!referencedUrlInfo.modifiedTimestamp) {
        return null;
      }
      return {
        hmr: "",
        v: referencedUrlInfo.modifiedTimestamp,
      };
    },
  };
};
