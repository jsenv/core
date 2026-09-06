/*
 * When client wants to hot reload, it wants to be sure it can reach the server
 * and bypass any cache. This is done thanks to "hot" search param
 * being injected by the client: file.js?hot=Date.now()
 * When it happens server must:
 * 1. Consider it's a regular request to "file.js" and not a variation
 * of it (not like file.js?as_js_classic that creates a separate urlInfo)
 * -> This is done by redirectReference deleting the search param.
 *
 * 2. Inject ?hot= into all urls referenced by this one
 * -> This is done by transformReferenceSearchParams
 */

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
      return urlObject.href;
    },
    transformReferenceSearchParams: (reference) => {
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
      // At this stage the parent is using ?hot and we are going to decide if
      // we propagate the search param to child.
      const referencedUrlInfo = reference.urlInfo;
      const {
        modifiedTimestamp,
        descendantModifiedTimestamp,
        dereferencedTimestamp,
        servedWithoutHotTimestamp,
      } = referencedUrlInfo;
      if (
        !modifiedTimestamp &&
        !descendantModifiedTimestamp &&
        !dereferencedTimestamp
      ) {
        return null;
      }
      // The goal is to send an url that will bypass client (the browser) cache
      // more precisely the runtime cache of js modules, but also any http cache
      // that could prevent re-execution of js code
      // In order to achieve this, this plugin inject ?hot=timestamp
      // - The browser will likely not have it in cache
      //   and refetch latest version from server + re-execute it
      // - If the browser have it in cache, he will not get it from server
      // We use the latest timestamp to ensure it's fresh
      // The dereferencedTimestamp is needed because when a js module is re-referenced
      // browser must re-execute it, even if the code is not modified
      const latestTimestamp = Math.max(
        modifiedTimestamp,
        descendantModifiedTimestamp,
        dereferencedTimestamp,
      );
      // These timestamps say "this url changed at some point", not "the client
      // is running an outdated version of it": they are never cleared, so a
      // file modified once keeps them for the rest of the dev server's life.
      // A client that fetched this url after that modification (a page load:
      // see rememberServedWithoutHot in the dev server) already runs the
      // latest content. Sending it "?hot" then makes the browser evaluate a
      // second, identical copy of a module it already has — a second module
      // scope for a file that never changed, which breaks everything a module
      // holds once (registries, contexts, singletons).
      if (latestTimestamp <= servedWithoutHotTimestamp) {
        return null;
      }
      return {
        hot: latestTimestamp,
      };
    },
  };
};
