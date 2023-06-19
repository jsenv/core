import { normalizeUrl, getCallerPosition, stringifyUrlSite } from "@jsenv/urls";

import { isWebWorkerEntryPointReference } from "../web_workers.js";
import { prependContent } from "../prepend_content.js";
import { GRAPH_VISITOR } from "./url_graph_visitor.js";

export const applyReferenceEffectsOnUrlInfo = (
  reference,
  referencedUrlInfo,
) => {
  referencedUrlInfo.reference = reference;
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

export const createDependencies = (ownerUrlInfo) => {
  const { dependencyReferenceSet, dependencyUrlSet, implicitUrlSet } =
    ownerUrlInfo;

  const dependencies = {};

  const startCollecting = async (
    callback,
    context = ownerUrlInfo.kitchen.context,
  ) => {
    dependencies.isCollecting = true;
    let prevDependencyReferenceSet = new Set(dependencyReferenceSet);
    dependencyReferenceSet.clear();
    dependencies.context = context;

    const stopCollecting = () => {
      dependencyReferenceSet.forEach((dependencyReference) => {
        if (dependencyReference.isResourceHint) {
          // resource hint are a special kind of reference.
          // They are a sort of weak reference to an url.
          // We ignore them so that url referenced only by resource hints
          // have url.dependentUrlSet.size === 0 and can be considered as not used
          // It means html won't consider url referenced solely
          // by <link> as dependency and it's fine
          return;
        }

        dependencyUrlSet.add(dependencyReference.url);
        const referencedUrlInfo = ownerUrlInfo.graph.reuseOrCreateUrlInfo(
          dependencyReference.url,
        );
        referencedUrlInfo.dependentReferenceSet.add(dependencyReference);
        referencedUrlInfo.dependentUrlSet.add(dependencyReference.url);

        // an implicit reference do not appear in the file but the non explicited file
        // have an impact on it
        // -> package.json on import resolution for instance
        // in that case:
        // - file depends on the implicit file (it must autoreload if package.json is modified)
        // - cache validity for the file depends on the implicit file (it must be re-cooked if package.json is modified)
        if (dependencyReference.isImplicit) {
          implicitUrlSet.add(dependencyReference.url);
        }
      });
      implicitUrlSet.forEach((implicitUrl) => {
        if (ownerUrlInfo.isInline) {
          const parentUrlInfo = ownerUrlInfo.graph.getUrlInfo(
            ownerUrlInfo.inlineUrlSite.url,
          );
          parentUrlInfo.implicitUrlSet.add(implicitUrl);
        }
      });

      const prunedUrlInfos = [];
      const prune = (urlInfo, reference) => {
        urlInfo.dependencyReferenceSet.delete(reference);
        urlInfo.dependencyUrlSet.delete(reference.url);
        const referencedUrlInfo = urlInfo.graph.getUrlInfo(reference.url);
        if (!referencedUrlInfo) {
          return;
        }
        referencedUrlInfo.dependentReferenceSet.delete(reference);
        referencedUrlInfo.dependentUrlSet.delete(reference.url);
        if (referencedUrlInfo.dependentUrlSet.size === 0) {
          referencedUrlInfo.dependencyReferenceSet.forEach(
            (dependencyReference) => {
              prune(referencedUrlInfo, dependencyReference);
            },
          );
          prunedUrlInfos.push(referencedUrlInfo);
        }
      };
      prevDependencyReferenceSet.forEach((prevDependencyReference) => {
        if (!dependencyUrlSet.has(prevDependencyReference.url)) {
          prune(ownerUrlInfo, prevDependencyReference);
        }
      });
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
      implicitUrlSet.forEach((implicitUrl) => {
        if (!dependencyUrlSet.has(implicitUrl)) {
          let implicitUrlComesFromInlineContent = false;
          for (const dependencyUrl of dependencyUrlSet) {
            const dependencyUrlInfo =
              ownerUrlInfo.graph.getUrlInfo(dependencyUrl);
            if (
              dependencyUrlInfo.isInline &&
              dependencyUrlInfo.implicitUrlSet.has(implicitUrl)
            ) {
              implicitUrlComesFromInlineContent = true;
              break;
            }
          }
          if (!implicitUrlComesFromInlineContent) {
            implicitUrlSet.delete(implicitUrl);
          }
          if (ownerUrlInfo.isInline) {
            const parentUrlInfo = ownerUrlInfo.graph.getUrlInfo(
              ownerUrlInfo.inlineUrlSite.url,
            );
            parentUrlInfo.implicitUrlSet.delete(implicitUrl);
          }
        }
      });
      prevDependencyReferenceSet.clear();
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
    const [reference, referencedUrlInfo] =
      ownerUrlInfo.kitchen.context.resolveReference(originalReference);
    return [reference, referencedUrlInfo];
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
    const [ref, referencedUrlInfo] = prepare({
      trace,
      ...rest,
    });
    addDependency(ref);
    return [ref, referencedUrlInfo];
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
    const [ref, referencedUrlInfo] = prepare({
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
    addDependency(ref);
    return [ref, referencedUrlInfo];
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
      const [ref, referencedUrlInfo] = prepare({
        trace,
        type: "side_effect_file",
        isImplicit: true,
        injected: true,
        specifier: sideEffectFileUrl,
        ...rest,
      });
      addDependency(ref);
      return [ref, referencedUrlInfo];
    };

    const injectAsBannerCodeBeforeFinalize = (
      sideEffectFileReference,
      sideEffectFileUrlInfo,
    ) => {
      ownerUrlInfo.callbacksToConsiderContentReady.push(async () => {
        await sideEffectFileUrlInfo.cook();
        await prependContent(ownerUrlInfo, sideEffectFileUrlInfo);
        await sideEffectFileReference.readGeneratedSpecifier();
        sideEffectFileReference.becomesInline({
          specifier: sideEffectFileReference.generatedSpecifier,
          content: sideEffectFileUrlInfo.content,
          contentType: sideEffectFileUrlInfo.contentType,
          line: 0,
          column: 0,
        });
      });
      return [sideEffectFileReference, sideEffectFileUrlInfo];
    };

    // When possible we inject code inside the file in the HTML
    // -> less duplication

    // Case #1: Not possible to inject in other files -> inject as banner code
    if (!["js_classic", "js_module", "css"].includes(ownerUrlInfo.type)) {
      const [sideEffectFileReference, sideEffectFileUrlInfo] =
        addSideEffectFileRef();
      return injectAsBannerCodeBeforeFinalize(
        sideEffectFileReference,
        sideEffectFileUrlInfo,
      );
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
      const [sideEffectFileReference, sideEffectFileUrlInfo] =
        addSideEffectFileRef();
      if (!urlsBeforeInjection.includes(sideEffectFileReference.url)) {
        return injectAsBannerCodeBeforeFinalize(
          sideEffectFileReference,
          sideEffectFileUrlInfo,
        );
      }
      const isReferencingSideEffectFile = (urlInfo) =>
        urlInfo.references.some(
          (ref) => ref.url === sideEffectFileReference.url,
        );
      const selfOrAncestorIsReferencingSideEffectFile = (dependentUrl) => {
        const dependentUrlInfo = ownerUrlInfo.graph.getUrlInfo(dependentUrl);
        if (isReferencingSideEffectFile(dependentUrlInfo)) {
          return true;
        }
        const dependentReferencingThatFile = GRAPH_VISITOR.findDependent(
          ownerUrlInfo,
          (ancestorUrlInfo) => isReferencingSideEffectFile(ancestorUrlInfo),
        );
        return Boolean(dependentReferencingThatFile);
      };
      for (const dependentUrl of ownerUrlInfo.dependentUrlSet) {
        if (!selfOrAncestorIsReferencingSideEffectFile(dependentUrl)) {
          return injectAsBannerCodeBeforeFinalize(
            sideEffectFileReference,
            sideEffectFileUrlInfo,
          );
        }
      }
      return [sideEffectFileReference, sideEffectFileUrlInfo];
    }

    // Case #3: During build
    // during build, files are not executed so it's
    // possible to inject reference when discovering a side effect file
    if (ownerUrlInfo.isEntryPoint) {
      const [sideEffectFileReference, sideEffectFileUrlInfo] =
        addSideEffectFileRef();
      return injectAsBannerCodeBeforeFinalize(
        sideEffectFileReference,
        sideEffectFileUrlInfo,
      );
    }
    const entryPoints = ownerUrlInfo.graph.getEntryPoints();
    const [sideEffectFileReference, sideEffectFileUrlInfo] =
      addSideEffectFileRef();
    for (const entryPointUrlInfo of entryPoints) {
      dependencies.context.addCallbackToConsiderGraphCooked(async () => {
        // do not inject if already there
        const { dependencyUrlSet } = entryPointUrlInfo;
        if (dependencyUrlSet.has(sideEffectFileUrlInfo.url)) {
          return;
        }
        dependencyUrlSet.add(sideEffectFileUrlInfo.url);
        await prependContent(entryPointUrlInfo, sideEffectFileUrlInfo);
        await sideEffectFileReference.readGeneratedSpecifier();
        sideEffectFileReference.becomesInline({
          specifier: sideEffectFileReference.generatedSpecifier,
          ownerUrlInfo: entryPointUrlInfo,
          content: sideEffectFileUrlInfo.content,
          contentType: sideEffectFileUrlInfo.contentType,
          // ideally get the correct line and column
          // (for js it's 0, but for html it's different)
          line: 0,
          column: 0,
        });
      });
    }
    return [sideEffectFileReference, sideEffectFileUrlInfo];
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
    const [ref, referencedUrlInfo] = prepare({
      trace,
      injected: true,
      ...rest,
    });
    addDependency(ref);
    return [ref, referencedUrlInfo];
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
    url: null,
    searchParams: null,
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
    replaceDependency(reference, inlineCopy);
    return inlineCopy;
  };

  reference.getWithoutSearchParam = ({ searchParam, expectedType }) => {
    const urlObject = new URL(ownerUrlInfo.url);
    const { searchParams } = urlObject;
    if (!searchParams.has(searchParam)) {
      return [null, null];
    }
    searchParams.delete(searchParam);
    const originalRef = reference || reference.original || reference;
    const referenceWithoutSearchParam = {
      ...originalRef,
      original: originalRef,
      searchParams,
      data: { ...originalRef.data },
      expectedType,
      specifier: originalRef.specifier
        .replace(`?${searchParam}`, "")
        .replace(`&${searchParam}`, ""),
      url: normalizeUrl(urlObject.href),
      generatedSpecifier: null,
      generatedUrl: null,
      filename: null,
    };
    const urlInfoWithoutSearchParam = ownerUrlInfo.graph.reuseOrCreateUrlInfo(
      referenceWithoutSearchParam,
    );
    return [referenceWithoutSearchParam, urlInfoWithoutSearchParam];
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

  const { dependencies } = ownerUrlInfo;
  ownerUrlInfo.dependencyReferenceSet.add(reference);
  if (dependencies.isCollecting) {
    // if this function is called while collecting urlInfo references
    // there is no need to update dependentUrlSet + dependencyUrlSet
    // because it will be done at the end of reference collection
    return;
  }
  if (reference.isResourceHint) {
    return;
  }
  if (
    reference.isImplicit &&
    !reference.isInline &&
    !ownerUrlInfo.implicitUrlSet.has(reference.url)
  ) {
    ownerUrlInfo.implicitUrlSet.add(reference.url);
    if (ownerUrlInfo.isInline) {
      const parentUrlInfo = ownerUrlInfo.graph.getUrlInfo(
        ownerUrlInfo.inlineUrlSite.url,
      );
      parentUrlInfo.implicitUrlSet.add(reference.url);
    }
  }
  ownerUrlInfo.dependencyUrlSet.add(reference.url);
  const referencedUrlInfo = ownerUrlInfo.graph.reuseOrCreateUrlInfo(reference);
  referencedUrlInfo.dependentReferenceSet.add(reference);
  referencedUrlInfo.dependentUrlSet.add(ownerUrlInfo.url);
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

  const { dependencyReferenceSet } = ownerUrlInfo;
  if (!dependencyReferenceSet.has(reference)) {
    throw new Error(`reference not found in ${ownerUrlInfo.url}`);
  }

  const { dependencies } = ownerUrlInfo;
  if (dependencies.isCollecting) {
    // if this function is called while collecting urlInfo references
    // there is no need to update dependentUrlSet + dependencyUrlSet
    // because it will be done at the end of reference collection
    dependencyReferenceSet.delete(reference);
    return;
  }

  if (reference.isImplicit && !reference.isInline) {
    let hasAnOtherImplicitRef = false;
    for (const dependencyReference of dependencyReferenceSet) {
      if (
        dependencyReference.isImplicit &&
        dependencyReference.url === reference.url
      ) {
        hasAnOtherImplicitRef = true;
        break;
      }
    }
    if (!hasAnOtherImplicitRef) {
      ownerUrlInfo.implicitUrlSet.delete(reference.url);
    }
  }

  let hasAnOtherRef = false;
  for (const dependencyReference of dependencyReferenceSet) {
    if (dependencyReference.url === reference.url) {
      hasAnOtherRef = true;
      break;
    }
  }
  dependencyReferenceSet.delete(reference);
  if (!hasAnOtherRef) {
    ownerUrlInfo.dependencyUrlSet.delete(reference.url);
    const referencedUrlInfo = ownerUrlInfo.graph.getUrlInfo(reference.url);
    referencedUrlInfo.dependentReferenceSet.delete(reference);
    referencedUrlInfo.dependentUrlSet.delete(reference.url);
    if (!referencedUrlInfo.isUsed()) {
      referencedUrlInfo.deleteFromGraph();
    }
  }
};

const replaceDependency = (reference, newReference) => {
  const { ownerUrlInfo } = reference;
  const newOwnerUrlInfo = newReference.ownerUrlInfo;
  if (ownerUrlInfo === newOwnerUrlInfo) {
    const { dependencyReferenceSet } = ownerUrlInfo;
    if (!dependencyReferenceSet.has(reference)) {
      throw new Error(`reference not found in ${ownerUrlInfo.url}`);
    }
    const { dependencies } = ownerUrlInfo;
    if (dependencies.isCollecting) {
      // if this function is called while collecting urlInfo references
      // there is no need to update dependentUrlSet + dependencyUrlSet
      // because it will be done at the end of reference collection
      dependencyReferenceSet.delete(reference);
      dependencyReferenceSet.add(newReference);
      storeReferenceChain(reference, newReference);
      return;
    }
    removeDependency(reference);
    addDependency(newReference);
    storeReferenceChain(reference, newReference);
    return;
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
