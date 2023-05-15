export const jsenvPluginUrlVersion = () => {
  return {
    name: "jsenv:url_version",
    appliesDuring: "dev",
    redirectReference: (reference) => {
      // "v" search param goal is to enable long-term cache
      // for server response headers
      // it is also used by hmr to bypass browser cache
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      const version = reference.searchParams.get("v");
      if (version) {
        const urlObject = new URL(reference.url);
        urlObject.searchParams.delete("v");
        reference.version = version;
        return urlObject.href;
      }
      return null;
    },
    transformReferenceSearchParams: (reference) => {
      if (!reference.version) {
        return null;
      }
      if (reference.searchParams.has("v")) {
        return null;
      }
      return {
        v: reference.version,
      };
    },
  };
};
