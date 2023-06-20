import { urlToRelativeUrl } from "@jsenv/urls";

import { urlSpecifierEncoding } from "./url_specifier_encoding.js";
import {
  applyReferenceEffectsOnUrlInfo,
  createDependencies,
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
  const getUrlInfo = (key) => {
    if (typeof key === "string") {
      return urlInfoMap.get(key);
    }
    if (typeof key === "object" && key && key.url) {
      return urlInfoMap.get(key.url);
    }
    return null;
  };
  const deleteUrlInfo = (url) => {
    const urlInfo = urlInfoMap.get(url);
    if (urlInfo) {
      urlInfoMap.delete(url);
      urlInfo.referenceToOthersSet.forEach((referenceToOther) => {
        const referencedUrlInfo = getUrlInfo(referenceToOther.url);
        referencedUrlInfo.referenceFromOthersSet.delete(referenceToOther);
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
    addUrlInfo(referencedUrlInfo);
    if (referencedUrlInfo.originalUrl === undefined) {
      applyReferenceEffectsOnUrlInfo(reference, referencedUrlInfo);
    }
    createUrlInfoCallbackRef.current(referencedUrlInfo);
    return referencedUrlInfo;
  };

  const inferReference = (specifier, parentUrl) => {
    const parentUrlInfo = getUrlInfo(parentUrl);
    if (!parentUrlInfo) {
      return null;
    }
    const seen = [];
    const search = (urlInfo) => {
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        if (urlSpecifierEncoding.decode(referenceToOther) === specifier) {
          return referenceToOther;
        }
      }
      for (const referenceToOther of parentUrlInfo.referenceToOthersSet) {
        if (seen.includes(referenceToOther.url)) {
          continue;
        }
        seen.push(referenceToOther.url);
        const referencedUrlInfo = getUrlInfo(referenceToOther.url);
        if (referencedUrlInfo.isInline) {
          const firstRef = search(referencedUrlInfo);
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
        if (urlInfo.referenceToOthersSet.size) {
          const relativeUrl = urlToRelativeUrl(urlInfo.url, rootDirectoryUrl);
          const referencedUrlSet = new Set();
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            data[relativeUrl] = referencedUrlSet.add(referenceToOther.url);
          }
          data[relativeUrl] = Array.from(referencedUrlSet).map(
            (referencedUrl) =>
              urlToRelativeUrl(referencedUrl, rootDirectoryUrl),
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
    kitchen: null,
    error: null,
    modifiedTimestamp: 0,
    originalContentEtag: null,
    contentEtag: null,
    isWatched: false,
    isValid: () => false,
    data: {}, // plugins can put whatever they want here
    referenceToOthersSet: new Set(),
    referenceFromOthersSet: new Set(),
    firstReference: null, // first reference from an other url to this one
    implicitUrlSet: new Set(),

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
  urlInfo.searchParams = new URL(url).searchParams;

  urlInfo.dependencies = createDependencies(urlInfo);
  urlInfo.hasDependent = () => {
    for (const referenceFromOther of urlInfo.referenceFromOthersSet) {
      if (referenceFromOther.url === urlInfo.url) {
        if (
          !referenceFromOther.isInline &&
          referenceFromOther.next &&
          referenceFromOther.next.isInline
        ) {
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
      urlInfo.referenceFromOthersSet.forEach((referenceFromOther) => {
        const urlInfoReferencingThisOne = urlInfo.graph.getUrlInfo(
          referenceFromOther.url,
        );
        const { hotAcceptDependencies = [] } = urlInfoReferencingThisOne.data;
        if (!hotAcceptDependencies.includes(urlInfo.url)) {
          iterate(urlInfoReferencingThisOne);
        }
      });
      urlInfo.referenceToOthersSet.forEach((referenceToOther) => {
        const referencedUrlInfo = urlInfo.graph.getUrlInfo(
          referenceToOther.url,
        );
        if (referencedUrlInfo.isInline) {
          iterate(referencedUrlInfo);
        }
      });
    };
    iterate(urlInfo);
  };
  urlInfo.deleteFromGraph = () => {
    urlInfo.graph.deleteUrlInfo(urlInfo.url);
  };
  urlInfo.cook = (context) => {
    context = context
      ? { ...urlInfo.kitchen.context, ...context }
      : urlInfo.kitchen.context;
    return urlInfo.kitchen.context.cook(urlInfo, context);
  };
  urlInfo.cookDependencies = (context) => {
    context = context
      ? { ...urlInfo.kitchen.context, ...context }
      : urlInfo.kitchen.context;
    return urlInfo.kitchen.context.cookDependencies(urlInfo, context);
  };
  urlInfo.fetchUrlContent = (context) => {
    context = context
      ? { ...urlInfo.kitchen.context, ...context }
      : urlInfo.kitchen.context;
    return urlInfo.kitchen.context.fetchUrlContent(urlInfo, context);
  };
  urlInfo.transformUrlContent = (context) => {
    context = context
      ? { ...urlInfo.kitchen.context, ...context }
      : urlInfo.kitchen.context;
    return urlInfo.kitchen.context.transformUrlContent(urlInfo, context);
  };
  urlInfo.finalizeUrlContent = (context) => {
    context = context
      ? { ...urlInfo.kitchen.context, ...context }
      : urlInfo.kitchen.context;
    return urlInfo.kitchen.context.finalizeUrlContent(urlInfo, context);
  };
  urlInfo.mutateContent = (transformations) => {
    return urlInfo.kitchen.context.urlInfoTransformer.applyTransformations(
      urlInfo,
      transformations,
    );
  };

  const contentTransformationCallbacks = [];
  urlInfo.addContentTransformationCallback = (callback) => {
    if (urlInfo.contentFinalized) {
      if (urlInfo.kitchen.context.dev) {
        throw new Error(
          `cannot add a transform callback on content already sent to the browser.
--- content url ---
${urlInfo.url}`,
        );
      }
      urlInfo.kitchen.context.addLastTransformationCallback(callback);
    } else {
      contentTransformationCallbacks.push(callback);
    }
  };
  urlInfo.applyContentTransformationCallbacks = async () => {
    for (const callback of contentTransformationCallbacks) {
      await callback();
    }
    contentTransformationCallbacks.length = 0;
  };

  // Object.preventExtensions(urlInfo) // useful to ensure all properties are declared here
  return urlInfo;
};
