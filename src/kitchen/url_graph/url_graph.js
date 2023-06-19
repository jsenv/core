import { urlToRelativeUrl } from "@jsenv/urls";

import { urlSpecifierEncoding } from "./url_specifier_encoding.js";
import {
  applyReferenceEffectsOnUrlInfo,
  createReferences,
} from "./references.js";

export const createUrlGraph = ({
  rootDirectoryUrl,
  kitchen,
  name = "anonymous",
}) => {
  const urlGraph = {};
  const createUrlInfoCallbackRef = { current: () => {} };
  const prunedUrlInfosCallbackRef = { current: () => {} };

  const urlInfoMap = new Map();
  const getUrlInfo = (url) => urlInfoMap.get(url);
  const deleteUrlInfo = (url) => {
    const urlInfo = urlInfoMap.get(url);
    if (urlInfo) {
      urlInfoMap.delete(url);
      urlInfo.references.forEach((reference) => {
        const referencedUrlInfo = getUrlInfo(reference.url);
        referencedUrlInfo.dependents.delete(url);
        referencedUrlInfo.references.inverted.delete(reference);
      });
    }
  };
  const addUrlInfo = (urlInfo) => {
    urlInfo.graph = urlGraph;
    urlInfo.kitchen = kitchen;
    urlInfoMap.set(urlInfo.url, urlInfo);
  };
  const reuseOrCreateUrlInfo = (reference, useGeneratedUrl) => {
    const referencedUrl = useGeneratedUrl
      ? reference.generatedUrl
      : reference.url;
    const existingUrlInfo = getUrlInfo(referencedUrl);
    if (existingUrlInfo) return existingUrlInfo;
    const referencedUrlInfo = createUrlInfo(referencedUrl);
    if (referencedUrlInfo.originalUrl === undefined) {
      applyReferenceEffectsOnUrlInfo(reference, referencedUrlInfo);
    }
    createUrlInfoCallbackRef.current(referencedUrlInfo);
    addUrlInfo(referencedUrlInfo);
    return referencedUrlInfo;
  };

  const inferReference = (specifier, parentUrl) => {
    const parentUrlInfo = getUrlInfo(parentUrl);
    if (!parentUrlInfo) {
      return null;
    }
    const seen = [];
    const search = (urlInfo) => {
      const firstReferenceFound = urlInfo.references.find((reference) => {
        return urlSpecifierEncoding.decode(reference) === specifier;
      });
      if (firstReferenceFound) {
        return firstReferenceFound;
      }
      for (const dependencyUrl of parentUrlInfo.dependencyUrlSet) {
        if (seen.includes(dependencyUrl)) {
          continue;
        }
        seen.push(dependencyUrl);
        const dependencyUrlInfo = getUrlInfo(dependencyUrl);
        if (dependencyUrlInfo.isInline) {
          const firstRef = search(dependencyUrlInfo);
          if (firstRef) {
            return firstRef;
          }
        }
      }
      return null;
    };
    return search(parentUrlInfo);
  };

  const getEntryPoints = () => {
    const entryPoints = [];
    urlInfoMap.forEach((urlInfo) => {
      if (urlInfo.isEntryPoint) {
        entryPoints.push(urlInfo);
      }
    });
    return entryPoints;
  };

  const rootUrlInfo = createUrlInfo(rootDirectoryUrl);
  rootUrlInfo.isRoot = true;
  addUrlInfo(rootUrlInfo);

  Object.assign(urlGraph, {
    name,
    rootUrlInfo,
    createUrlInfoCallbackRef,
    prunedUrlInfosCallbackRef,

    urlInfoMap,
    reuseOrCreateUrlInfo,
    getUrlInfo,
    deleteUrlInfo,
    getEntryPoints,

    inferReference,

    toObject: () => {
      const data = {};
      urlInfoMap.forEach((urlInfo) => {
        data[urlInfo.url] = urlInfo;
      });
      return data;
    },
    toJSON: (rootDirectoryUrl) => {
      const data = {};
      urlInfoMap.forEach((urlInfo) => {
        const dependencyUrls = Array.from(urlInfo.dependencyUrlSet);
        if (dependencyUrls.length) {
          const relativeUrl = urlToRelativeUrl(urlInfo.url, rootDirectoryUrl);
          data[relativeUrl] = dependencyUrls.map((dependencyUrl) =>
            urlToRelativeUrl(dependencyUrl, rootDirectoryUrl),
          );
        }
      });
      return data;
    },
  });
  return urlGraph;
};

const createUrlInfo = (url) => {
  const urlInfo = {
    isRoot: false,
    graph: null,
    error: null,
    modifiedTimestamp: 0,
    originalContentEtag: null,
    contentEtag: null,
    isWatched: false,
    isValid: () => false,
    data: {}, // plugins can put whatever they want here
    dependencySet: new Set(), // references to other urls are put in this set
    dependencyUrlSet: new Set(), // same as above but contains only reference urls (faster access)
    dependentSet: new Set(), // references from other urls to this one are put in this set
    dependentUrlSet: new Set(), // same as above but contains only reference urls (faster access)
    reference: null, // first reference from an other url to this one

    implicitUrls: new Set(),
    type: undefined, // "html", "css", "js_classic", "js_module", "importmap", "sourcemap", "json", "webmanifest", ...
    subtype: undefined, // "worker", "service_worker", "shared_worker" for js, otherwise undefined
    typeHint: undefined,
    subtypeHint: undefined,
    contentType: "", // "text/html", "text/css", "text/javascript", "application/json", ...
    url: null,
    originalUrl: undefined,
    filename: "",
    isEntryPoint: false,
    originalContent: undefined,
    originalContentAst: undefined,
    content: undefined,
    contentAst: undefined,
    contentFinalized: false,
    callbacksToConsiderContentReady: [],

    sourcemap: null,
    sourcemapIsWrong: false,

    generatedUrl: null,
    sourcemapGeneratedUrl: null,
    injected: false,

    isInline: false,
    inlineUrlSite: null,
    jsQuote: null, // maybe move to inlineUrlSite?

    timing: {},
    headers: {},
    debug: false,
  };
  Object.defineProperty(urlInfo, "url", {
    enumerable: true,
    configurable: false,
    writable: false,
    value: url,
  });

  urlInfo.references = createReferences(urlInfo);
  urlInfo.hasDependent = () => {
    for (const reference of urlInfo.references.inverted) {
      if (reference.url === urlInfo.url) {
        if (!reference.isInline && reference.next && reference.next.isInline) {
          // the url info was inlined, an other reference is required
          // to consider the non-inlined urlInfo as used
          continue;
        }
        return true;
      }
    }
    return false;
  };
  urlInfo.isUsed = () => {
    // nothing uses this url anymore
    // - versioning update inline content
    // - file converted for import assertion or js_classic conversion
    // - urlInfo for a file that is now inlined
    if (urlInfo.isEntryPoint) {
      return true;
    }
    // if (urlInfo.type === "sourcemap") {
    //   return true;
    // }
    // check if there is a valid reference to this urlInfo
    if (urlInfo.hasDependent()) {
      return true;
    }
    return false;
  };
  urlInfo.getParentIfInline = (urlInfo) => {
    return urlInfo.isInline
      ? urlInfo.graph.getUrlInfo(urlInfo.inlineUrlSite.url)
      : urlInfo;
  };
  urlInfo.considerModified = (modifiedTimestamp = Date.now()) => {
    const seen = [];
    const iterate = (urlInfo) => {
      if (seen.includes(urlInfo.url)) {
        return;
      }
      seen.push(urlInfo.url);
      urlInfo.modifiedTimestamp = modifiedTimestamp;
      urlInfo.originalContentEtag = undefined;
      urlInfo.contentEtag = undefined;
      urlInfo.dependents.forEach((dependentUrl) => {
        const dependentUrlInfo = urlInfo.graph.getUrlInfo(dependentUrl);
        const { hotAcceptDependencies = [] } = dependentUrlInfo.data;
        if (!hotAcceptDependencies.includes(urlInfo.url)) {
          iterate(dependentUrlInfo);
        }
      });
      urlInfo.dependencyUrlSet.forEach((dependencyUrl) => {
        const dependencyUrlInfo = urlInfo.graph.getUrlInfo(dependencyUrl);
        if (dependencyUrlInfo.isInline) {
          iterate(dependencyUrlInfo);
        }
      });
    };
    iterate(urlInfo);
  };
  urlInfo.deleteFromGraph = () => {
    urlInfo.graph.deleteUrlInfo(urlInfo.url);
  };
  urlInfo.cook = (context) => {
    return urlInfo.kitchen.context.cook(urlInfo, context);
  };
  urlInfo.cookReferences = (context) => {
    return urlInfo.kitchen.context.cookReferences(urlInfo, context);
  };
  urlInfo.fetchUrlContent = (context) => {
    return urlInfo.kitchen.context.fetchUrlContent(urlInfo, context);
  };

  // Object.preventExtensions(urlInfo) // useful to ensure all properties are declared here
  return urlInfo;
};
