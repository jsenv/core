import {
  urlToRelativeUrl,
  asUrlWithoutSearch,
  injectQueryParamsIntoSpecifier,
} from "@jsenv/urls";

import { urlSpecifierEncoding } from "./url_specifier_encoding.js";
import { createDependencies } from "./references.js";

export const createUrlGraph = ({
  rootDirectoryUrl,
  kitchen,
  name = "anonymous",
}) => {
  const urlGraph = {};
  const createUrlInfoCallbackRef = { current: () => {} };
  const pruneUrlInfoCallbackRef = { current: () => {} };

  const urlInfoMap = new Map();
  const hasUrlInfo = (key) => {
    if (typeof key === "string") {
      return urlInfoMap.has(key);
    }
    if (typeof key === "object" && key && key.url) {
      return urlInfoMap.has(key.url);
    }
    return null;
  };
  const getUrlInfo = (key) => {
    if (typeof key === "string") {
      return urlInfoMap.get(key);
    }
    if (typeof key === "object" && key && key.url) {
      return urlInfoMap.get(key.url);
    }
    return null;
  };
  const deleteUrlInfo = (url, lastReferenceFromOther) => {
    const urlInfo = urlInfoMap.get(url);
    if (urlInfo) {
      urlInfo.kitchen.urlInfoTransformer.resetContent(urlInfo);
      urlInfoMap.delete(url);
      urlInfo.modifiedTimestamp = Date.now();
      if (lastReferenceFromOther && !urlInfo.isInline) {
        pruneUrlInfoCallbackRef.current(urlInfo, lastReferenceFromOther);
      }
      urlInfo.referenceToOthersSet.forEach((referenceToOther) => {
        referenceToOther.remove();
      });
      if (urlInfo.searchParams.size > 0) {
        const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url);
        const urlInfoWithoutSearch = getUrlInfo(urlWithoutSearch);
        if (urlInfoWithoutSearch) {
          urlInfoWithoutSearch.searchParamVariantSet.delete(urlInfo);
        }
      }
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
    const ownerUrlInfo = reference.ownerUrlInfo;
    const ownerContext = ownerUrlInfo.context;
    const context = Object.create(ownerContext);
    const referencedUrlInfo = createUrlInfo(referencedUrl, context);
    addUrlInfo(referencedUrlInfo);
    createUrlInfoCallbackRef.current(referencedUrlInfo);
    if (referencedUrlInfo.searchParams.size > 0 && !kitchen.context.shape) {
      // A resource is represented by a url.
      // Variations of a resource are represented by url search params
      // Each representation of the resource is given a dedicated url info
      // object (one url -> one url info)
      // It's because search params often influence the final content returned for that url
      // When a reference contains url search params it must create 2 url infos:
      // 1. The url info corresponding to the url with search params
      // 2. The url info corresponding to url without search params
      // Because the underlying content without search params is used to generate
      // the content modified according to search params
      // This way when a file like "style.css" is considered as modified
      // references like "style.css?as_css_module" are also affected
      const urlWithoutSearch = asUrlWithoutSearch(reference.url);
      // a reference with a search param creates an implicit reference
      // to the file without search param
      const referenceWithoutSearch = reference.addImplicit({
        specifier: urlWithoutSearch,
        url: urlWithoutSearch,
        searchParams: new URLSearchParams(),
        isWeak: true,
      });
      const urlInfoWithoutSearch = referenceWithoutSearch.urlInfo;
      urlInfoWithoutSearch.searchParamVariantSet.add(referencedUrlInfo);
    }
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
        const referencedUrlInfo = referenceToOther.urlInfo;
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

  const rootUrlInfo = createUrlInfo(rootDirectoryUrl, kitchen.context);
  rootUrlInfo.isRoot = true;
  addUrlInfo(rootUrlInfo);

  Object.assign(urlGraph, {
    name,
    rootUrlInfo,
    createUrlInfoCallbackRef,
    pruneUrlInfoCallbackRef,

    urlInfoMap,
    reuseOrCreateUrlInfo,
    hasUrlInfo,
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

const createUrlInfo = (url, context) => {
  const urlInfo = {
    isRoot: false,
    graph: null,
    kitchen: null,
    context,
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
    searchParamVariantSet: new Set(),

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
  urlInfo.getFirstReferenceFromOther = ({ ignoreWeak } = {}) => {
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
        if (ignoreWeak && referenceFromOther.isWeak) {
          // weak reference don't count as using the url
          continue;
        }
        return referenceFromOther;
      }
    }
    return null;
  };
  urlInfo.isUsed = () => {
    if (urlInfo.isRoot) {
      return true;
    }
    // if (urlInfo.type === "sourcemap") {
    //   return true;
    // }
    // check if there is a strong reference to this urlInfo
    if (urlInfo.getFirstReferenceFromOther({ ignoreWeak: true })) {
      return true;
    }
    // nothing uses this url anymore
    // - versioning update inline content
    // - file converted for import assertion or js_classic conversion
    // - urlInfo for a file that is now inlined
    return false;
  };
  urlInfo.findParentIfInline = () => {
    let currentUrlInfo = urlInfo;
    const graph = urlInfo.graph;
    while (currentUrlInfo.isInline) {
      const parentUrlInfo = graph.getUrlInfo(currentUrlInfo.inlineUrlSite.url);
      if (!parentUrlInfo.isInline) {
        return parentUrlInfo;
      }
      currentUrlInfo = parentUrlInfo;
    }
    return null;
  };
  urlInfo.isSearchParamVariantOf = (otherUrlInfo) => {
    if (urlInfo.searchParams.size === 0) {
      return false;
    }
    if (otherUrlInfo.searchParams.size > 0) {
      return false;
    }
    const withoutSearch = asUrlWithoutSearch(urlInfo.url);
    if (withoutSearch === otherUrlInfo.url) {
      return true;
    }
    return false;
  };
  urlInfo.getWithoutSearchParam = (searchParam, { expectedType } = {}) => {
    // The search param can be
    // 1. injected by a plugin during "redirectReference"
    //    - import assertions
    //    - js module fallback to systemjs
    // 2. already inside source files
    //    - turn js module into js classic for convenience ?as_js_classic
    //    - turn js classic to js module for to make it importable
    if (!urlInfo.searchParams.has(searchParam)) {
      return null;
    }
    const reference = urlInfo.firstReference;
    const newSpecifier = injectQueryParamsIntoSpecifier(reference.specifier, {
      [searchParam]: undefined,
    });
    const referenceWithoutSearchParam = reference.addImplicit({
      type: reference.type,
      subtype: reference.subtype,
      expectedContentType: reference.expectedContentType,
      expectedType: expectedType || reference.expectedType,
      expectedSubtype: reference.expectedSubtype,
      integrity: reference.integrity,
      crossorigin: reference.crossorigin,
      specifierStart: reference.specifierStart,
      specifierEnd: reference.specifierEnd,
      specifierLine: reference.specifierLine,
      specifierColumn: reference.specifierColumn,
      baseUrl: reference.baseUrl,
      isOriginalPosition: reference.isOriginalPosition,
      isEntryPoint: reference.isEntryPoint,
      isResourceHint: reference.isResourceHint,
      hasVersioningEffect: reference.hasVersioningEffect,
      version: reference.version,
      content: reference.content,
      contentType: reference.contentType,
      leadsToADirectory: reference.leadsToADirectory,
      debug: reference.debug,
      importAttributes: reference.importAttributes,
      importNode: reference.importNode,
      importTypeAttributeNode: reference.importTypeAttributeNode,
      mutation: reference.mutation,
      data: { ...reference.data },
      specifier: newSpecifier,
      isWeak: true,
      isInline: false,
      original: reference.original || reference,
      prev: reference,
      // urlInfo: null,
      // url: null,
      // generatedUrl: null,
      // generatedSpecifier: null,
      // filename: null,
    });
    reference.next = referenceWithoutSearchParam;
    return referenceWithoutSearchParam.urlInfo;
  };
  urlInfo.considerModified = ({ modifiedTimestamp = Date.now() } = {}) => {
    const visitedSet = new Set();
    const iterate = (urlInfo) => {
      if (visitedSet.has(urlInfo)) {
        return;
      }
      visitedSet.add(urlInfo);
      urlInfo.modifiedTimestamp = modifiedTimestamp;
      urlInfo.kitchen.urlInfoTransformer.resetContent(urlInfo);
      for (const referenceToOther of urlInfo.referenceToOthersSet) {
        const referencedUrlInfo = referenceToOther.urlInfo;
        if (referencedUrlInfo.isInline) {
          iterate(referencedUrlInfo);
        }
      }
      for (const searchParamVariant of urlInfo.searchParamVariantSet) {
        iterate(searchParamVariant);
      }
    };
    iterate(urlInfo);
  };
  urlInfo.deleteFromGraph = (reference) => {
    urlInfo.graph.deleteUrlInfo(urlInfo.url, reference);
  };
  urlInfo.cook = (customContext) => {
    return urlInfo.context.cook(urlInfo, customContext);
  };
  urlInfo.cookDependencies = (options) => {
    return urlInfo.context.cookDependencies(urlInfo, options);
  };
  urlInfo.fetchContent = () => {
    return urlInfo.context.fetchUrlContent(urlInfo);
  };
  urlInfo.transformContent = () => {
    return urlInfo.context.transformUrlContent(urlInfo);
  };
  urlInfo.finalizeContent = () => {
    return urlInfo.context.finalizeUrlContent(urlInfo);
  };
  urlInfo.mutateContent = (transformations) => {
    return urlInfo.kitchen.urlInfoTransformer.applyTransformations(
      urlInfo,
      transformations,
    );
  };

  const contentTransformationCallbackSet = new Set();
  urlInfo.addContentTransformationCallback = (callback) => {
    if (urlInfo.contentFinalized) {
      if (urlInfo.context.dev) {
        throw new Error(
          `cannot add a transform callback on content already sent to the browser.
--- content url ---
${urlInfo.url}`,
        );
      }
      urlInfo.context.addLastTransformationCallback(callback);
    } else {
      contentTransformationCallbackSet.add(callback);
    }
  };
  urlInfo.applyContentTransformationCallbacks = async () => {
    for (const contentTransformationCallback of contentTransformationCallbackSet) {
      await contentTransformationCallback();
    }
    contentTransformationCallbackSet.clear();
  };

  // Object.preventExtensions(urlInfo) // useful to ensure all properties are declared here
  return urlInfo;
};
