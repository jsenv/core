export const jsenvPluginHmr = () => {
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
    transformReferenceSearchParams: (reference, context) => {
      if (reference.type === "package_json") {
        // maybe the if above shoulb be .isImplicit but it's just a detail anyway
        return null;
      }
      if (context.reference && !context.reference.data.hmr) {
        // parent do not use hmr search param
        return null;
      }
      if (!context.reference && !reference.data.hmr) {
        // entry point do not use hmr search param
        return null;
      }
      const urlInfo = context.urlGraph.getUrlInfo(reference.url);
      if (!urlInfo.modifiedTimestamp) {
        return null;
      }
      return {
        hmr: "",
        v: urlInfo.modifiedTimestamp,
      };
    },
  };
};
