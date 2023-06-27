import { getCallerPosition, stringifyUrlSite } from "@jsenv/urls";

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
    const kitchen = ownerUrlInfo.kitchen;
    const urlInfo = kitchen.graph.reuseOrCreateUrlInfo(reference);
    reference.urlInfo = urlInfo;
    addDependency(reference);
    kitchen.context.finalizeReference(reference);

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
      const reference = parentUrlInfo.dependencies.prepare({
        trace,
        type: "side_effect_file",
        isImplicit: true,
        injected: true,
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
    if (ownerUrlInfo.kitchen.context.dev) {
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
    const reference = prepare({
      trace,
      injected: true,
      ...rest,
    });
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
  // urlInfo referenced solely by weak references
  // should be ignored during build
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
    escape: null,
    // import assertions (maybe move to data?)
    importAttributes,
    importNode,
    importTypeAttributeNode,
    mutation,
    debug,
  };

  reference.resolve = () => {
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

  reference.redirect = (url, props = {}) => {
    const referenceRedirected = createReference({
      ...reference,
      ...props,
    });
    referenceRedirected.specifier = url;
    referenceRedirected.url = url;
    referenceRedirected.prev = reference;
    referenceRedirected.original = reference.original || reference;
    reference.next = referenceRedirected;
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
      original: reference.original || reference,
      prev: reference,
      ...props,
    });
    removeDependency(reference);
    reference.next = inlineCopy;
    return inlineCopy;
  };

  reference.getWithoutSearchParam = ({ searchParam, expectedType }) => {
    if (!reference.searchParams.has(searchParam)) {
      return null;
    }

    const newSpecifier = reference.specifier
      .replace(`?${searchParam}`, "")
      .replace(`&${searchParam}`, "");
    const referenceWithoutSearchParam = ownerUrlInfo.dependencies.prepare({
      ...reference,
      url: null,
      isImplicit: true,
      isWeak: true,
      data: { ...reference.data },
      expectedType,
      specifier: newSpecifier,
      generatedSpecifier: null,
      filename: null,
      original: reference.original || reference,
      prev: reference,
      redirection: false,
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
  if (
    ownerUrlInfo.contentFinalized &&
    ownerUrlInfo.kitchen.context.dev &&
    !ownerUrlInfo.isRoot
  ) {
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
};

const removeDependency = (reference) => {
  const { ownerUrlInfo } = reference;
  if (
    ownerUrlInfo.contentFinalized &&
    ownerUrlInfo.kitchen.context.dev &&
    !ownerUrlInfo.isRoot
  ) {
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

  const firstStrongReferenceFromOther =
    referencedUrlInfo.getFirstStrongReferenceFromOther();
  if (firstStrongReferenceFromOther) {
    // either applying new ref should override old ref
    // or we should first remove effects before adding new ones
    // for now we just set firstReference to null
    if (reference === referencedUrlInfo.firstReference) {
      referencedUrlInfo.firstReference = null;
      applyReferenceEffectsOnUrlInfo(firstStrongReferenceFromOther);
    }
  } else if (reference.type !== "http_request") {
    referencedUrlInfo.deleteFromGraph();
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
