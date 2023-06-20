import { normalizeUrl, getCallerPosition, stringifyUrlSite } from "@jsenv/urls";

import { isWebWorkerEntryPointReference } from "../web_workers.js";
import { prependContent } from "../prepend_content.js";
import { GRAPH_VISITOR } from "./url_graph_visitor.js";

export const createDependencies = (ownerUrlInfo) => {
  const { referenceToOthersSet } = ownerUrlInfo;

  const dependencies = {};

  const startCollecting = async (callback) => {
    dependencies.isCollecting = true;
    let prevReferenceToOthersSet = new Set(referenceToOthersSet);
    referenceToOthersSet.clear();

    const stopCollecting = () => {
      const prunedUrlInfos = [];
      const prune = (urlInfo, reference) => {
        urlInfo.referenceToOthersSet.delete(reference);
        const referencedUrlInfo = urlInfo.graph.getUrlInfo(reference.url);
        if (!referencedUrlInfo) {
          return;
        }
        referencedUrlInfo.referenceFromOthersSet.delete(reference);
        if (referencedUrlInfo.referenceFromOthersSet.size === 0) {
          referencedUrlInfo.referenceToOthersSet.forEach((referenceToOther) => {
            prune(referencedUrlInfo, referenceToOther);
          });
          prunedUrlInfos.push(referencedUrlInfo);
        }
      };
      for (const prevReferenceToOther of prevReferenceToOthersSet) {
        let referenceFound = null;
        for (const referenceToOther of referenceToOthersSet) {
          if (referenceToOther.url === prevReferenceToOther.url) {
            referenceFound = referenceToOther;
            break;
          }
        }
        if (!referenceFound) {
          prune(ownerUrlInfo, prevReferenceToOther);
        }
      }
      if (prunedUrlInfos.length) {
        prunedUrlInfos.forEach((prunedUrlInfo) => {
          prunedUrlInfo.modifiedTimestamp = Date.now();
          if (prunedUrlInfo.isInline) {
            // should we always delete?
            prunedUrlInfo.deleteFromGraph();
          }
        });
        ownerUrlInfo.graph.prunedUrlInfosCallbackRef.current(
          prunedUrlInfos,
          ownerUrlInfo,
        );
      }
      prevReferenceToOthersSet.clear();
      dependencies.isCollecting = false;
    };

    try {
      await callback();
    } finally {
      // finally to ensure reference are updated even in case of error
      stopCollecting();
    }
  };
  const prepare = (props) => {
    const originalReference = createReference({
      ownerUrlInfo,
      ...props,
    });
    const reference = originalReference.resolve();
    const urlInfo = ownerUrlInfo.kitchen.graph.reuseOrCreateUrlInfo(reference);
    reference.urlInfo = urlInfo;
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
    const reference = prepare({
      trace,
      ...rest,
    });
    addDependency(reference);
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
    const reference = prepare({
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
    addDependency(reference);
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

    const addSideEffectFileRef = () => {
      const reference = prepare({
        trace,
        type: "side_effect_file",
        isImplicit: true,
        injected: true,
        specifier: sideEffectFileUrl,
        ...rest,
      });
      addDependency(reference);
      return reference;
    };

    const injectAsBannerCodeBeforeFinalize = (sideEffectFileReference) => {
      ownerUrlInfo.addContentTransformationCallback(async () => {
        await sideEffectFileReference.urlInfo.cook();
        await prependContent(ownerUrlInfo, sideEffectFileReference.urlInfo);
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
    if (ownerUrlInfo.kitchen.context.dev) {
      const urlsBeforeInjection = Array.from(
        ownerUrlInfo.graph.urlInfoMap.keys(),
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
        const candidateUrlInfo = ownerUrlInfo.graph.getUrlInfo(candidateUrl);
        if (isReferencingSideEffectFile(candidateUrlInfo)) {
          return true;
        }
        const dependentReferencingThatFile = GRAPH_VISITOR.findDependent(
          ownerUrlInfo,
          (ancestorUrlInfo) => isReferencingSideEffectFile(ancestorUrlInfo),
        );
        return Boolean(dependentReferencingThatFile);
      };
      for (const referenceFromOther of ownerUrlInfo.referenceFromOthersSet) {
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
    if (ownerUrlInfo.isEntryPoint) {
      const sideEffectFileReference = addSideEffectFileRef();
      return injectAsBannerCodeBeforeFinalize(sideEffectFileReference);
    }
    const entryPoints = ownerUrlInfo.graph.getEntryPoints();
    const sideEffectFileReference = addSideEffectFileRef();
    for (const entryPointUrlInfo of entryPoints) {
      entryPointUrlInfo.addContentTransformationCallback(async () => {
        // do not inject if already there
        for (const referenceToOther of entryPointUrlInfo.referenceToOthersSet) {
          if (referenceToOther.url === sideEffectFileReference.url) {
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
    const reference = prepare({
      trace,
      injected: true,
      ...rest,
    });
    addDependency(reference);
    return reference;
  };

  Object.assign(dependencies, {
    isCollecting: false,
    startCollecting,
    prepare,
    found,
    foundInline,
    foundSideEffectFile,
    inject,
  });

  return dependencies;
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
  isImplicit = false,
  hasVersioningEffect = false,
  injected = false,
  isInline = false,
  content,
  contentType,
  assert,
  assertNode,
  typePropertyNode,
  leadsToADirectory = false,
  debug = false,
  prev = null,
  url = null,
  urlInfo = null,
  searchParams = null,
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
    original: null,
    prev,
    next: null,
    data,
    node,
    trace,
    url,
    urlInfo,
    searchParams,
    generatedUrl: null,
    generatedSpecifier: null,
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
    hasVersioningEffect,
    version: null,
    injected,
    timing: {},
    // for inline resources the reference contains the content
    isInline,
    content,
    contentType,
    escape: null,
    // import assertions (maybe move to data?)
    assert,
    assertNode,
    typePropertyNode,
    leadsToADirectory,
    mutation: null,
    debug,
  };

  reference.resolve = () => {
    if (reference.url) {
      return reference;
    }
    const resolvedReference =
      reference.ownerUrlInfo.kitchen.context.resolveReference(reference);
    return resolvedReference;
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

  reference.redirect = (url) => {
    const referenceRedirected = createReference({
      ...reference,
    });
    referenceRedirected.specifier = url;
    referenceRedirected.url = url;
    storeReferenceChain(reference, referenceRedirected);
    return referenceRedirected;
  };

  reference.becomesInline = ({
    specifier,
    content,
    contentType,
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
    const inlineCopy = ownerUrlInfo.dependencies.prepare({
      ...inlineProps,
      specifierLine: line,
      specifierColumn: column,
      specifier,
      content,
      contentType,
      prev: reference,
      ...props,
    });
    // inlineUrlInfo.isInline = true;
    replaceDependency(reference, inlineCopy);
    return inlineCopy;
  };

  reference.getWithoutSearchParam = ({ searchParam, expectedType }) => {
    if (!reference.searchParams.has(searchParam)) {
      return null;
    }
    const originalRef = reference.original || reference;
    const newUrlObject = new URL(originalRef.url);
    const newSearchParams = newUrlObject.searchParams;
    newSearchParams.delete(searchParam);
    const referenceWithoutSearchParam = ownerUrlInfo.dependencies.prepare({
      ...originalRef,
      isImplicit: true,
      original: originalRef,
      searchParams: newSearchParams,
      data: { ...originalRef.data },
      expectedType,
      specifier: originalRef.specifier
        .replace(`?${searchParam}`, "")
        .replace(`&${searchParam}`, ""),
      url: normalizeUrl(newUrlObject.href),
      generatedSpecifier: null,
      generatedUrl: null,
      filename: null,
    });
    addDependency(referenceWithoutSearchParam);
    return referenceWithoutSearchParam;
  };

  // Object.preventExtensions(reference) // useful to ensure all properties are declared here
  return reference;
};

const addDependency = (reference) => {
  const { ownerUrlInfo } = reference;
  if (ownerUrlInfo.contentFinalized && ownerUrlInfo.kitchen.context.dev) {
    throw new Error(
      `cannot add reference for content already sent to the browser
--- reference url ---
${reference.url}
--- content url ---
${ownerUrlInfo.url}`,
    );
  }

  ownerUrlInfo.referenceToOthersSet.add(reference);
  if (reference.isResourceHint) {
    // resource hint are a special kind of reference.
    // They are a sort of weak reference to an url.
    // We ignore them so that url referenced only by resource hints
    // have url.referenceFromOthers.size === 0 and can be considered as not used
    // It means html won't consider url referenced solely
    // by <link> as dependency and it's fine
    return;
  }

  if (
    reference.isImplicit &&
    !reference.isInline &&
    !ownerUrlInfo.implicitUrlSet.has(reference.url)
  ) {
    // an implicit reference do not appear in the file but the non explicited file
    // have an impact on it
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
};

const removeDependency = (reference) => {
  const { ownerUrlInfo } = reference;
  if (ownerUrlInfo.contentFinalized && ownerUrlInfo.kitchen.context.dev) {
    throw new Error(
      `cannot remove reference for content already sent to the browser
--- reference url ---
${reference.url}
--- content url ---
${ownerUrlInfo.url}`,
    );
  }

  const { referenceToOthersSet } = ownerUrlInfo;
  if (!referenceToOthersSet.has(reference)) {
    throw new Error(`reference not found in ${ownerUrlInfo.url}`);
  }

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

  referenceToOthersSet.delete(reference);

  const referencedUrlInfo = ownerUrlInfo.graph.getUrlInfo(reference.url);
  referencedUrlInfo.referenceFromOthersSet.delete(reference);

  let firstOtherRef;
  for (const referenceToOther of referenceToOthersSet) {
    if (
      referenceToOther.url === reference.url &&
      !referenceToOther.isResourceHint
    ) {
      firstOtherRef = referenceToOther;
      break;
    }
  }
  if (firstOtherRef) {
    // either applying new ref should override old ref
    // or we should first remove effects before adding new ones
    // for now we just set firstReference to null
    if (reference === referencedUrlInfo.firstReference) {
      referencedUrlInfo.firstReference = null;
      applyReferenceEffectsOnUrlInfo(firstOtherRef);
    }
  } else if (referencedUrlInfo.isUsed()) {
    // ideally we should remove reference effects
    referencedUrlInfo.firstReference = null;
  } else {
    referencedUrlInfo.deleteFromGraph();
  }
};

const replaceDependency = (reference, newReference) => {
  const { ownerUrlInfo } = reference;
  const newOwnerUrlInfo = newReference.ownerUrlInfo;
  if (ownerUrlInfo === newOwnerUrlInfo) {
    const { referenceToOthersSet } = ownerUrlInfo;
    if (!referenceToOthersSet.has(reference)) {
      throw new Error(`reference not found in ${ownerUrlInfo.url}`);
    }
  }
  removeDependency(reference);
  addDependency(newReference);
  storeReferenceChain(reference, newReference);
};

const storeReferenceChain = (ref, nextRef) => {
  ref.next = nextRef;
  nextRef.original = ref.original || ref;
  nextRef.prev = ref;
};

const traceFromUrlSite = (urlSite) => {
  return {
    message: stringifyUrlSite(urlSite),
    url: urlSite.url,
    line: urlSite.line,
    column: urlSite.column,
  };
};

const adjustUrlSite = (urlInfo, { urlGraph, url, line, column }) => {
  const isOriginal = url === urlInfo.url;
  const adjust = (urlSite, urlInfo) => {
    if (!urlSite.isOriginal) {
      return urlSite;
    }
    const inlineUrlSite = urlInfo.inlineUrlSite;
    if (!inlineUrlSite) {
      return urlSite;
    }
    const parentUrlInfo = urlGraph.getUrlInfo(inlineUrlSite.url);
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

const getInlineReferenceProps = (
  reference,
  { ownerUrlInfo, isOriginalPosition, line, column, ...rest },
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
    line,
    column,
    ...rest,
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
    referencedUrlInfo.contentType = reference.contentType;
    referencedUrlInfo.originalContent = referencedUrlInfo.kitchen.context.build
      ? referencedUrlInfo.originalContent === undefined
        ? reference.content
        : referencedUrlInfo.originalContent
      : reference.content;
    referencedUrlInfo.content = reference.content;
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
