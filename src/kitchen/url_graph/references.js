import {
  getCallerPosition,
  stringifyUrlSite,
  asUrlWithoutSearch,
} from "@jsenv/urls";

import { isWebWorkerEntryPointReference } from "../web_workers.js";
import { prependContent } from "../prepend_content.js";
import { GRAPH_VISITOR } from "./url_graph_visitor.js";

export const createDependencies = (ownerUrlInfo) => {
  const { referenceToOthersSet } = ownerUrlInfo;

  const startCollecting = async (callback) => {
    const prevReferenceToOthersSet = new Set(referenceToOthersSet);
    referenceToOthersSet.clear();

    const stopCollecting = () => {
      for (const prevReferenceToOther of prevReferenceToOthersSet) {
        applyDependencyRemovalEffects(prevReferenceToOther);
      }
      prevReferenceToOthersSet.clear();
    };

    try {
      await callback();
    } finally {
      // finally to ensure reference are updated even in case of error
      stopCollecting();
    }
  };

  const createResolveAndFinalize = (props) => {
    const originalReference = createReference({
      ownerUrlInfo,
      ...props,
    });
    const reference = originalReference.resolve();
    reference.finalize();
    return reference;
  };

  const found = ({ trace, ...rest }) => {
    if (trace === undefined) {
      trace = traceFromUrlSite(
        adjustUrlSite(ownerUrlInfo, {
          url: ownerUrlInfo.url,
          line: rest.specifierLine,
          column: rest.specifierColumn,
        }),
      );
    }
    const reference = createResolveAndFinalize({
      trace,
      ...rest,
    });
    return reference;
  };
  const foundInline = ({
    isOriginalPosition,
    specifierLine,
    specifierColumn,
    ...rest
  }) => {
    const parentUrl = isOriginalPosition
      ? ownerUrlInfo.url
      : ownerUrlInfo.generatedUrl;
    const parentContent = isOriginalPosition
      ? ownerUrlInfo.originalContent
      : ownerUrlInfo.content;
    const reference = createResolveAndFinalize({
      trace: traceFromUrlSite({
        url: parentUrl,
        content: parentContent,
        line: specifierLine,
        column: specifierColumn,
      }),
      isOriginalPosition,
      specifierLine,
      specifierColumn,
      isInline: true,
      ...rest,
    });
    return reference;
  };
  // side effect file
  const foundSideEffectFile = async ({ sideEffectFileUrl, trace, ...rest }) => {
    if (trace === undefined) {
      const { url, line, column } = getCallerPosition();
      trace = traceFromUrlSite({
        url,
        line,
        column,
      });
    }

    const parentUrlInfo = ownerUrlInfo.findParentIfInline() || ownerUrlInfo;

    const addSideEffectFileRef = () => {
      const reference = parentUrlInfo.firstReference.addImplicit({
        trace,
        type: "side_effect_file",
        specifier: sideEffectFileUrl,
        ...rest,
      });
      return reference;
    };

    const injectAsBannerCodeBeforeFinalize = (sideEffectFileReference) => {
      parentUrlInfo.addContentTransformationCallback(async () => {
        await sideEffectFileReference.urlInfo.cook();
        await prependContent(parentUrlInfo, sideEffectFileReference.urlInfo);
        await sideEffectFileReference.readGeneratedSpecifier();
        sideEffectFileReference.becomesInline({
          specifier: sideEffectFileReference.generatedSpecifier,
          content: sideEffectFileReference.urlInfo.content,
          contentType: sideEffectFileReference.urlInfo.contentType,
          line: 0,
          column: 0,
        });
      });
      return sideEffectFileReference;
    };

    // When possible we inject code inside the file in the HTML
    // -> less duplication

    // Case #1: Not possible to inject in other files -> inject as banner code
    if (!["js_classic", "js_module", "css"].includes(ownerUrlInfo.type)) {
      const sideEffectFileReference = addSideEffectFileRef();
      return injectAsBannerCodeBeforeFinalize(sideEffectFileReference);
    }

    // Case #2: During dev
    // during dev cooking files is incremental
    // so HTML is already executed by the browser
    // but if we find that ref in a dependent we are good
    // and it's possible to find it in dependents when using
    // dynamic import for instance
    // (in that case we find the side effect file as it was injected in parent)
    if (ownerUrlInfo.context.dev) {
      const urlsBeforeInjection = Array.from(
        parentUrlInfo.graph.urlInfoMap.keys(),
      );
      const sideEffectFileReference = addSideEffectFileRef();
      if (!urlsBeforeInjection.includes(sideEffectFileReference.url)) {
        return injectAsBannerCodeBeforeFinalize(sideEffectFileReference);
      }
      const isReferencingSideEffectFile = (urlInfo) => {
        for (const referenceToOther of urlInfo.referenceToOthersSet) {
          if (referenceToOther.url === sideEffectFileReference.url) {
            return true;
          }
        }
        return false;
      };
      const selfOrAncestorIsReferencingSideEffectFile = (candidateUrl) => {
        const candidateUrlInfo = parentUrlInfo.graph.getUrlInfo(candidateUrl);
        if (isReferencingSideEffectFile(candidateUrlInfo)) {
          return true;
        }
        const dependentReferencingThatFile = GRAPH_VISITOR.findDependent(
          parentUrlInfo,
          (ancestorUrlInfo) => isReferencingSideEffectFile(ancestorUrlInfo),
        );
        return Boolean(dependentReferencingThatFile);
      };
      for (const referenceFromOther of parentUrlInfo.referenceFromOthersSet) {
        if (
          !selfOrAncestorIsReferencingSideEffectFile(referenceFromOther.url)
        ) {
          return injectAsBannerCodeBeforeFinalize(sideEffectFileReference);
        }
      }
      return sideEffectFileReference;
    }

    // Case #3: During build
    // during build, files are not executed so it's
    // possible to inject reference when discovering a side effect file
    if (parentUrlInfo.isEntryPoint) {
      const sideEffectFileReference = addSideEffectFileRef();
      return injectAsBannerCodeBeforeFinalize(sideEffectFileReference);
    }

    const entryPoints = parentUrlInfo.graph.getEntryPoints();
    const sideEffectFileReference = addSideEffectFileRef();
    for (const entryPointUrlInfo of entryPoints) {
      entryPointUrlInfo.addContentTransformationCallback(async () => {
        // do not inject if already there
        if (entryPointUrlInfo.implicitUrlSet.has(sideEffectFileReference.url)) {
          sideEffectFileReference.remove();
          return;
        }
        // put it right away in implicit url set to allow
        // content transformation callbacks to be called concurrently
        // and still prevent side effect file content duplicate injection
        entryPointUrlInfo.implicitUrlSet.add(sideEffectFileReference.url);

        // never happens in reality but in case the side effect file is already explicitely
        // referenced by the entry point
        for (const referenceToOther of entryPointUrlInfo.referenceToOthersSet) {
          if (referenceToOther.url === sideEffectFileReference.url) {
            sideEffectFileReference.remove();
            return;
          }
        }

        await sideEffectFileReference.urlInfo.cook();
        await prependContent(
          entryPointUrlInfo,
          sideEffectFileReference.urlInfo,
        );
        await sideEffectFileReference.readGeneratedSpecifier();
        sideEffectFileReference.becomesInline({
          specifier: sideEffectFileReference.generatedSpecifier,
          ownerUrlInfo: entryPointUrlInfo,
          content: sideEffectFileReference.urlInfo.content,
          contentType: sideEffectFileReference.urlInfo.contentType,
          // ideally get the correct line and column
          // (for js it's 0, but for html it's different)
          line: 0,
          column: 0,
        });
      });
    }
    return sideEffectFileReference;
  };

  const inject = ({ trace, ...rest }) => {
    if (trace === undefined) {
      const { url, line, column } = getCallerPosition();
      trace = traceFromUrlSite({
        url,
        line,
        column,
      });
    }
    const reference = createResolveAndFinalize({
      trace,
      injected: true,
      ...rest,
    });
    return reference;
  };

  return {
    startCollecting,
    createResolveAndFinalize,
    found,
    foundInline,
    foundSideEffectFile,
    inject,
  };
};

/*
 * - "http_request"
 * - "entry_point"
 * - "link_href"
 * - "style"
 * - "script"
 * - "a_href"
 * - "iframe_src
 * - "img_src"
 * - "img_srcset"
 * - "source_src"
 * - "source_srcset"
 * - "image_href"
 * - "use_href"
 * - "css_@import"
 * - "css_url"
 * - "js_import"
 * - "js_import_script"
 * - "js_url"
 * - "js_inline_content"
 * - "sourcemap_comment"
 * - "webmanifest_icon_src"
 * - "package_json"
 * - "side_effect_file"
 * */
const createReference = ({
  ownerUrlInfo,
  data = {},
  node,
  trace,
  type,
  subtype,
  expectedContentType,
  expectedType,
  expectedSubtype,
  filename,
  integrity,
  crossorigin,
  specifier,
  specifierStart,
  specifierEnd,
  specifierLine,
  specifierColumn,
  baseUrl,
  isOriginalPosition,
  isEntryPoint = false,
  isResourceHint = false,
  // implicit references are not real references
  // they represent an abstract relationship
  isImplicit = false,
  // weak references cannot keep the corresponding url info alive
  // there must be an other reference to keep the url info alive
  // an url referenced solely by weak references is:
  // - not written in build directory
  // - can be removed from graph during dev/build
  // - not cooked until referenced by a strong reference
  isWeak = false,
  hasVersioningEffect = false,
  version = null,
  injected = false,
  isInline = false,
  content,
  contentType,
  leadsToADirectory = false,
  debug = false,
  original = null,
  prev = null,
  next = null,
  url = null,
  searchParams = null,
  generatedUrl = null,
  generatedSpecifier = null,
  urlInfo = null,
  redirection = true,
  escape = null,
  // import assertions
  importAttributes,
  importNode,
  importTypeAttributeNode,
  mutation,
}) => {
  if (typeof specifier !== "string") {
    if (specifier instanceof URL) {
      specifier = specifier.href;
    } else {
      throw new TypeError(`"specifier" must be a string, got ${specifier}`);
    }
  }
  const reference = {
    ownerUrlInfo,
    original,
    prev,
    next,
    data,
    node,
    trace,
    url,
    urlInfo,
    searchParams,
    generatedUrl,
    generatedSpecifier,
    redirection,
    type,
    subtype,
    expectedContentType,
    expectedType,
    expectedSubtype,
    filename,
    integrity,
    crossorigin,
    specifier,
    specifierStart,
    specifierEnd,
    specifierLine,
    specifierColumn,
    isOriginalPosition,
    baseUrl,
    isEntryPoint,
    isResourceHint,
    isImplicit,
    implicitReferenceSet: new Set(),
    isWeak,
    hasVersioningEffect,
    version,
    injected,
    timing: {},
    leadsToADirectory,
    // for inline resources the reference contains the content
    isInline,
    content,
    contentType,
    escape,
    // import assertions (maybe move to data?)
    importAttributes,
    importNode,
    importTypeAttributeNode,
    mutation,
    debug,
  };

  reference.resolve = () => {
    const resolvedReference =
      reference.ownerUrlInfo.context.resolveReference(reference);
    return resolvedReference;
  };

  reference.redirect = (url, props = {}) => {
    const redirectedProps = getRedirectedReferenceProps(reference, url);
    const referenceRedirected = createReference({
      ...redirectedProps,
      ...props,
    });
    reference.next = referenceRedirected;
    return referenceRedirected;
  };

  reference.finalize = () => {
    if (reference.urlInfo) {
      return;
    }
    const kitchen = ownerUrlInfo.kitchen;
    const urlInfo = kitchen.graph.reuseOrCreateUrlInfo(reference);
    reference.urlInfo = urlInfo;
    if (urlInfo.searchParams.size > 0) {
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
      });
      const urlInfoWithoutSearch = referenceWithoutSearch.urlInfo;
      urlInfoWithoutSearch.searchParamVariantSet.add(urlInfo);
    }
    addDependency(reference);
    ownerUrlInfo.context.finalizeReference(reference);
  };

  // "formatReferencedUrl" can be async BUT this is an exception
  // for most cases it will be sync. We want to favor the sync signature to keep things simpler
  // The only case where it needs to be async is when
  // the specifier is a `data:*` url
  // in this case we'll wait for the promise returned by
  // "formatReferencedUrl"
  reference.readGeneratedSpecifier = () => {
    if (reference.generatedSpecifier.then) {
      return reference.generatedSpecifier.then((value) => {
        reference.generatedSpecifier = value;
        return value;
      });
    }
    return reference.generatedSpecifier;
  };

  reference.becomesInline = ({
    line,
    column,
    // when urlInfo is given it means reference is moved into an other file
    ownerUrlInfo = reference.ownerUrlInfo,
    ...props
  }) => {
    const inlineProps = getInlineReferenceProps(reference, {
      ownerUrlInfo,
      line,
      column,
    });
    const inlineCopy = ownerUrlInfo.dependencies.createResolveAndFinalize({
      ...inlineProps,
      ...props,
    });
    // when a file gets inlined (like CSS in HTML)
    // the previous reference (like <link rel="stylesheet">) is going to be removed
    // we must tell to all the things referenced by CSS that they are sill referenced
    // by the inline reference before removing the link reference:
    // - ensure url info still aware they are referenced and thus kept in the graph
    for (const referenceToOther of reference.urlInfo.referenceToOthersSet) {
      const referencedUrlInfo = referenceToOther.urlInfo;
      referencedUrlInfo.referenceFromOthersSet.add(inlineCopy);
    }
    removeDependency(reference);
    reference.next = inlineCopy;
    return inlineCopy;
  };

  reference.addImplicit = (props) => {
    const implicitReference = ownerUrlInfo.dependencies.inject({
      ...props,
      isImplicit: true,
    });
    reference.implicitReferenceSet.add(implicitReference);
    return implicitReference;
  };

  reference.getWithoutSearchParam = ({ searchParam, expectedType }) => {
    // The search param can be
    // 1. injected by a plugin during "redirectReference"
    //    - import assertions
    //    - js module fallback to systemjs
    // 2. already inside source files
    //    - turn js module into js classic for convenience ?as_js_classic
    //    - turn js classic to js module for to make it importable
    if (!reference.searchParams.has(searchParam)) {
      return null;
    }
    const newSpecifier = reference.specifier
      .replace(`?${searchParam}`, "")
      .replace(`&${searchParam}`, "");
    const referenceWithoutSearchParam = reference.addImplicit({
      type,
      subtype,
      expectedContentType,
      expectedType,
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
      redirection: false,
      // urlInfo: null,
      // url: null,
      // generatedUrl: null,
      // generatedSpecifier: null,
      // filename: null,
    });
    reference.next = referenceWithoutSearchParam;
    return referenceWithoutSearchParam;
  };

  reference.remove = () => removeDependency(reference);

  // Object.preventExtensions(reference) // useful to ensure all properties are declared here
  return reference;
};

const addDependency = (reference) => {
  const { ownerUrlInfo } = reference;
  if (ownerUrlInfo.referenceToOthersSet.has(reference)) {
    return;
  }
  if (!canAddOrRemoveReference(reference)) {
    throw new Error(
      `cannot add reference for content already sent to the browser
--- reference url ---
${reference.url}
--- content url ---
${ownerUrlInfo.url}`,
    );
  }
  ownerUrlInfo.referenceToOthersSet.add(reference);
  if (reference.isImplicit) {
    // an implicit reference is a reference that does not explicitely appear in the file
    // but has an impact on the file
    // -> package.json on import resolution for instance
    // in that case:
    // - file depends on the implicit file (it must autoreload if package.json is modified)
    // - cache validity for the file depends on the implicit file (it must be re-cooked if package.json is modified)
    ownerUrlInfo.implicitUrlSet.add(reference.url);
    if (ownerUrlInfo.isInline) {
      const parentUrlInfo = ownerUrlInfo.graph.getUrlInfo(
        ownerUrlInfo.inlineUrlSite.url,
      );
      parentUrlInfo.implicitUrlSet.add(reference.url);
    }
  }
  const referencedUrlInfo = reference.urlInfo;
  referencedUrlInfo.referenceFromOthersSet.add(reference);
  applyReferenceEffectsOnUrlInfo(reference);
  for (const implicitRef of reference.implicitReferenceSet) {
    addDependency(implicitRef);
  }
};

const removeDependency = (reference) => {
  const { ownerUrlInfo } = reference;
  if (!ownerUrlInfo.referenceToOthersSet.has(reference)) {
    return false;
  }
  if (!canAddOrRemoveReference(reference)) {
    throw new Error(
      `cannot remove reference for content already sent to the browser
--- reference url ---
${reference.url}
--- content url ---
${ownerUrlInfo.url}`,
    );
  }
  for (const implicitRef of reference.implicitReferenceSet) {
    implicitRef.remove();
  }
  ownerUrlInfo.referenceToOthersSet.delete(reference);
  return applyDependencyRemovalEffects(reference);
};

const canAddOrRemoveReference = (reference) => {
  if (reference.isWeak || reference.isImplicit) {
    // weak and implicit references have no restrictions
    // because they are not actual references with an influence on content
    return true;
  }
  const { ownerUrlInfo } = reference;
  if (ownerUrlInfo.context.build) {
    // during build url content is not executed
    // it's still possible to mutate references safely
    return true;
  }
  if (!ownerUrlInfo.contentFinalized) {
    return true;
  }
  if (ownerUrlInfo.isRoot) {
    // the root urlInfo is abstract, there is no real file behind it
    return true;
  }
  if (reference.type === "http_request") {
    // reference created to http requests are abstract concepts
    return true;
  }
  return false;
};

const applyDependencyRemovalEffects = (reference) => {
  const { ownerUrlInfo } = reference;
  const { referenceToOthersSet } = ownerUrlInfo;

  if (reference.isImplicit && !reference.isInline) {
    let hasAnOtherImplicitRef = false;
    for (const referenceToOther of referenceToOthersSet) {
      if (
        referenceToOther.isImplicit &&
        referenceToOther.url === reference.url
      ) {
        hasAnOtherImplicitRef = true;
        break;
      }
    }
    if (!hasAnOtherImplicitRef) {
      ownerUrlInfo.implicitUrlSet.delete(reference.url);
    }
  }

  const prevReference = reference.prev;
  const nextReference = reference.next;
  if (prevReference && nextReference) {
    nextReference.prev = prevReference;
    prevReference.next = nextReference;
  } else if (prevReference) {
    prevReference.next = null;
  } else if (nextReference) {
    nextReference.original = null;
    nextReference.prev = null;
  }

  const referencedUrlInfo = reference.urlInfo;
  referencedUrlInfo.referenceFromOthersSet.delete(reference);

  const firstReferenceFromOther =
    referencedUrlInfo.getFirstReferenceFromOther();
  if (firstReferenceFromOther) {
    // either applying new ref should override old ref
    // or we should first remove effects before adding new ones
    // for now we just set firstReference to null
    if (reference === referencedUrlInfo.firstReference) {
      referencedUrlInfo.firstReference = null;
      applyReferenceEffectsOnUrlInfo(firstReferenceFromOther);
    }
    return false;
  }
  if (reference.type !== "http_request") {
    referencedUrlInfo.deleteFromGraph(reference);
    return true;
  }
  return false;
};

const traceFromUrlSite = (urlSite) => {
  return {
    message: stringifyUrlSite(urlSite),
    url: urlSite.url,
    line: urlSite.line,
    column: urlSite.column,
  };
};

const adjustUrlSite = (urlInfo, { url, line, column }) => {
  const isOriginal = url === urlInfo.url;
  const adjust = (urlSite, urlInfo) => {
    if (!urlSite.isOriginal) {
      return urlSite;
    }
    const inlineUrlSite = urlInfo.inlineUrlSite;
    if (!inlineUrlSite) {
      return urlSite;
    }
    const parentUrlInfo = urlInfo.graph.getUrlInfo(inlineUrlSite.url);
    return adjust(
      {
        isOriginal: true,
        url: inlineUrlSite.url,
        content: inlineUrlSite.content,
        line:
          inlineUrlSite.line === undefined
            ? urlSite.line
            : inlineUrlSite.line + urlSite.line,
        column:
          inlineUrlSite.column === undefined
            ? urlSite.column
            : inlineUrlSite.column + urlSite.column,
      },
      parentUrlInfo,
    );
  };
  return adjust(
    {
      isOriginal,
      url,
      content: isOriginal ? urlInfo.originalContent : urlInfo.content,
      line,
      column,
    },
    urlInfo,
  );
};

const getRedirectedReferenceProps = (reference, url) => {
  const redirectedProps = {
    ...reference,
    specifier: url,
    url,
    original: reference.original || reference,
    prev: reference,
  };
  return redirectedProps;
};

const getInlineReferenceProps = (
  reference,
  { ownerUrlInfo, isOriginalPosition, line, column },
) => {
  const trace = traceFromUrlSite({
    url:
      ownerUrlInfo === undefined
        ? isOriginalPosition
          ? reference.ownerUrlInfo.url
          : reference.ownerUrlInfo.generatedUrl
        : reference.ownerUrlInfo.url,
    content:
      ownerUrlInfo === undefined
        ? isOriginalPosition
          ? reference.ownerUrlInfo.originalContent
          : reference.ownerUrlInfo.content
        : ownerUrlInfo.content,
    line,
    column,
  });
  return {
    trace,
    isInline: true,
    specifierLine: line,
    specifierColumn: column,
    original: reference.original || reference,
    prev: reference,
  };
};

const applyReferenceEffectsOnUrlInfo = (reference) => {
  const referencedUrlInfo = reference.urlInfo;

  if (referencedUrlInfo.firstReference) {
    return;
  }
  referencedUrlInfo.firstReference = reference;
  referencedUrlInfo.originalUrl =
    referencedUrlInfo.originalUrl || reference.url;

  if (reference.isEntryPoint || isWebWorkerEntryPointReference(reference)) {
    referencedUrlInfo.isEntryPoint = true;
  }
  Object.assign(referencedUrlInfo.data, reference.data);
  Object.assign(referencedUrlInfo.timing, reference.timing);
  if (reference.injected) {
    referencedUrlInfo.injected = true;
  }
  if (reference.filename && !referencedUrlInfo.filename) {
    referencedUrlInfo.filename = reference.filename;
  }
  if (reference.isInline) {
    referencedUrlInfo.isInline = true;
    referencedUrlInfo.inlineUrlSite = {
      url: reference.ownerUrlInfo.url,
      content: reference.isOriginalPosition
        ? reference.ownerUrlInfo.originalContent
        : reference.ownerUrlInfo.content,
      line: reference.specifierLine,
      column: reference.specifierColumn,
    };
  }

  if (reference.debug) {
    referencedUrlInfo.debug = true;
  }
  if (reference.expectedType) {
    referencedUrlInfo.typeHint = reference.expectedType;
  }
  if (reference.expectedSubtype) {
    referencedUrlInfo.subtypeHint = reference.expectedSubtype;
  }
};
