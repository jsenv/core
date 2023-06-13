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

  reference.replace = (newReference) => {
    const index = urlInfo.references.current.indexOf(reference);
    if (index === -1) {
      throw new Error(`reference do not exists`);
    }
    urlInfo.references.current[index] = newReference;
    // remove urlInfo previously referenced if not used anymore
    const previouslyReferencedUrlInfo = urlInfo.graph.getUrlInfo(reference.url);
    if (previouslyReferencedUrlInfo) {
      const referencedUrlInfo = urlInfo.graph.getUrlInfo(newReference.url);
      if (
        previouslyReferencedUrlInfo !== referencedUrlInfo &&
        !previouslyReferencedUrlInfo.isUsed()
      ) {
        urlInfo.graph.deleteUrlInfo(reference.url);
      }
    }
    // if this function is called while collecting urlInfo references
    // there is no need to update dependents + dependencies
    // because it will be done at the end of reference collection
    // otherwise we should update dependents + dependencies (TODO)
    storeReferenceTransformation(reference, newReference);
  };

  reference.movesTo = (newUrlInfo, newReference) => {
    const index = urlInfo.references.current.indexOf(reference);
    if (index === -1) {
      throw new Error(`reference do not exists`);
    }
    urlInfo.references.current.splice(index, 1);
    newUrlInfo.references.current.push(newReference);
    // if this function is called while collecting urlInfo references
    // there is no need to update dependents + dependencies
    // because it will be done at the end of reference collection
    // otherwise we should update dependents + dependencies (TODO)
    storeReferenceTransformation(reference, newReference);
  };

  // Object.preventExtensions(reference) // useful to ensure all properties are declared here
  return reference;
};

export const storeReferenceTransformation = (current, next) => {
  current.next = next;
  next.original = current.original || current;
  next.prev = current;
};
