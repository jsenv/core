import { normalizeUrl, stringifyUrlSite } from "@jsenv/urls";
import { isWebWorkerEntryPointReference } from "../web_workers.js";

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
export const createReference = ({
  urlInfo,
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
    urlInfo,
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

  reference.becomesInline = ({
    specifier,
    content,
    contentType,
    line,
    column,
    // when urlInfo is given it means reference is moved into an other file
    urlInfo = reference.urlInfo,
    ...props
  }) => {
    const inlineProps = getInlineReferenceProps(reference, {
      urlInfo,
      line,
      column,
    });
    const inlineCopy = urlInfo.references.prepare({
      ...inlineProps,
      specifierLine: line,
      specifierColumn: column,
      specifier,
      content,
      contentType,
      prev: reference,
      ...props,
    });
    replaceReference(reference, inlineCopy);
    return inlineCopy;
  };

  reference.getWithoutSearchParam = ({ searchParam, expectedType }) => {
    const urlObject = new URL(urlInfo.url);
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
    const urlInfoWithoutSearchParam = urlInfo.graph.reuseOrCreateUrlInfo(
      referenceWithoutSearchParam,
    );
    return [referenceWithoutSearchParam, urlInfoWithoutSearchParam];
  };

  // Object.preventExtensions(reference) // useful to ensure all properties are declared here
  return reference;
};

const replaceReference = (reference, newReference) => {
  const index = reference.urlInfo.references.current.indexOf(reference);
  if (index === -1) {
    throw new Error(`reference do not exists`);
  }

  // override in place
  if (reference.urlInfo === newReference.urlInfo) {
    reference.urlInfo.references.current[index] = newReference;
    // if this function is called while collecting urlInfo references
    // there is no need to update dependents + dependencies
    // because it will be done at the end of reference collection
    // otherwise we should update dependents + dependencies (TODO)
  }
  // move (remove current + insert new)
  else {
    reference.urlInfo.references.current.splice(index, 1);
    newReference.urlInfo.references.current.push(newReference);
    // if this function is called while collecting urlInfo references
    // there is no need to update dependents + dependencies
    // because it will be done at the end of reference collection
    // otherwise we should update dependents + dependencies (TODO)
    storeReferenceTransformation(reference, newReference);
  }

  // remove urlInfo previously referenced if not used anymore
  const previouslyReferencedUrlInfo = reference.urlInfo.graph.getUrlInfo(
    reference.url,
  );
  if (previouslyReferencedUrlInfo) {
    const referencedUrlInfo = reference.urlInfo.graph.getUrlInfo(
      newReference.url,
    );
    if (
      previouslyReferencedUrlInfo !== referencedUrlInfo &&
      !previouslyReferencedUrlInfo.isUsed()
    ) {
      previouslyReferencedUrlInfo.deleteFromGraph();
    }
  }
  storeReferenceTransformation(reference, newReference);
};

export const traceFromUrlSite = (urlSite) => {
  return {
    message: stringifyUrlSite(urlSite),
    url: urlSite.url,
    line: urlSite.line,
    column: urlSite.column,
  };
};

export const storeReferenceTransformation = (current, next) => {
  current.next = next;
  next.original = current.original || current;
  next.prev = current;
};

export const applyReferenceEffectsOnUrlInfo = (reference, urlInfo) => {
  urlInfo.originalUrl = urlInfo.originalUrl || reference.url;

  if (reference.isEntryPoint || isWebWorkerEntryPointReference(reference)) {
    urlInfo.isEntryPoint = true;
  }
  Object.assign(urlInfo.data, reference.data);
  Object.assign(urlInfo.timing, reference.timing);
  if (reference.injected) {
    urlInfo.injected = true;
  }
  if (reference.filename && !urlInfo.filename) {
    urlInfo.filename = reference.filename;
  }
  if (reference.isInline) {
    urlInfo.isInline = true;
    urlInfo.inlineUrlSite = {
      url: reference.urlInfo.url,
      content: reference.isOriginalPosition
        ? reference.urlInfo.originalContent
        : reference.urlInfo.content,
      line: reference.specifierLine,
      column: reference.specifierColumn,
    };
    urlInfo.contentType = reference.contentType;
    urlInfo.originalContent = urlInfo.kitchen.context.build
      ? urlInfo.originalContent === undefined
        ? reference.content
        : urlInfo.originalContent
      : reference.content;
    urlInfo.content = reference.content;
  }

  if (reference.debug) {
    urlInfo.debug = true;
  }
  if (reference.expectedType) {
    urlInfo.typeHint = reference.expectedType;
  }
  if (reference.expectedSubtype) {
    urlInfo.subtypeHint = reference.expectedSubtype;
  }
};

const getInlineReferenceProps = (
  reference,
  { urlInfo, isOriginalPosition, line, column, ...rest },
) => {
  const trace = traceFromUrlSite({
    url:
      urlInfo === undefined
        ? isOriginalPosition
          ? reference.urlInfo.url
          : reference.urlInfo.generatedUrl
        : reference.urlInfo.url,
    content:
      urlInfo === undefined
        ? isOriginalPosition
          ? reference.urlInfo.originalContent
          : reference.urlInfo.content
        : urlInfo.content,
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
