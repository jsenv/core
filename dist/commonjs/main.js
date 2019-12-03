'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var path = require('path');
var url$2 = require('url');
var util = require('util');
var fs = require('fs');
var net = require('net');
var crypto = require('crypto');
var http = require('http');
var https = require('https');
var stream = require('stream');
var os = require('os');
var vm = require('vm');
var child_process = require('child_process');

const assertImportMap = value => {
  if (value === null) {
    throw new TypeError(`an importMap must be an object, got null`);
  }

  const type = typeof value;

  if (type !== "object") {
    throw new TypeError(`an importMap must be an object, received ${value}`);
  }

  if (Array.isArray(value)) {
    throw new TypeError(`an importMap must be an object, received array ${value}`);
  }
};

const hasScheme = string => {
  return /^[a-zA-Z]{2,}:/.test(string);
};

const hrefToScheme = href => {
  const colonIndex = href.indexOf(":");
  if (colonIndex === -1) return "";
  return href.slice(0, colonIndex);
};

const hrefToPathname = href => {
  return ressourceToPathname(hrefToRessource(href));
};

const hrefToRessource = href => {
  const scheme = hrefToScheme(href);

  if (scheme === "file") {
    return href.slice("file://".length);
  }

  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = href.slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    return afterProtocol.slice(pathnameSlashIndex);
  }

  return href.slice(scheme.length + 1);
};

const ressourceToPathname = ressource => {
  const searchSeparatorIndex = ressource.indexOf("?");
  return searchSeparatorIndex === -1 ? ressource : ressource.slice(0, searchSeparatorIndex);
};

const hrefToOrigin = href => {
  const scheme = hrefToScheme(href);

  if (scheme === "file") {
    return "file://";
  }

  if (scheme === "http" || scheme === "https") {
    const secondProtocolSlashIndex = scheme.length + "://".length;
    const pathnameSlashIndex = href.indexOf("/", secondProtocolSlashIndex);
    if (pathnameSlashIndex === -1) return href;
    return href.slice(0, pathnameSlashIndex);
  }

  return href.slice(0, scheme.length + 1);
};

const pathnameToDirname = pathname => {
  const slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) return "";
  return pathname.slice(0, slashLastIndex);
};

// could be useful: https://url.spec.whatwg.org/#url-miscellaneous
const resolveUrl = (specifier, baseUrl) => {
  if (baseUrl) {
    if (typeof baseUrl !== "string") {
      throw new TypeError(writeBaseUrlMustBeAString({
        baseUrl,
        specifier
      }));
    }

    if (!hasScheme(baseUrl)) {
      throw new Error(writeBaseUrlMustBeAbsolute({
        baseUrl,
        specifier
      }));
    }
  }

  if (hasScheme(specifier)) {
    return specifier;
  }

  if (!baseUrl) {
    throw new Error(writeBaseUrlRequired({
      baseUrl,
      specifier
    }));
  } // scheme relative


  if (specifier.slice(0, 2) === "//") {
    return `${hrefToScheme(baseUrl)}:${specifier}`;
  } // origin relative


  if (specifier[0] === "/") {
    return `${hrefToOrigin(baseUrl)}${specifier}`;
  }

  const baseOrigin = hrefToOrigin(baseUrl);
  const basePathname = hrefToPathname(baseUrl);

  if (specifier === ".") {
    const baseDirname = pathnameToDirname(basePathname);
    return `${baseOrigin}${baseDirname}/`;
  } // pathname relative inside


  if (specifier.slice(0, 2) === "./") {
    const baseDirname = pathnameToDirname(basePathname);
    return `${baseOrigin}${baseDirname}/${specifier.slice(2)}`;
  } // pathname relative outside


  if (specifier.slice(0, 3) === "../") {
    let unresolvedPathname = specifier;
    const importerFolders = basePathname.split("/");
    importerFolders.pop();

    while (unresolvedPathname.slice(0, 3) === "../") {
      unresolvedPathname = unresolvedPathname.slice(3); // when there is no folder left to resolved
      // we just ignore '../'

      if (importerFolders.length) {
        importerFolders.pop();
      }
    }

    const resolvedPathname = `${importerFolders.join("/")}/${unresolvedPathname}`;
    return `${baseOrigin}${resolvedPathname}`;
  } // bare


  if (basePathname === "") {
    return `${baseOrigin}/${specifier}`;
  }

  if (basePathname[basePathname.length] === "/") {
    return `${baseOrigin}${basePathname}${specifier}`;
  }

  return `${baseOrigin}${pathnameToDirname(basePathname)}/${specifier}`;
};

const writeBaseUrlMustBeAString = ({
  baseUrl,
  specifier
}) => `baseUrl must be a string.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const writeBaseUrlMustBeAbsolute = ({
  baseUrl,
  specifier
}) => `baseUrl must be absolute.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const writeBaseUrlRequired = ({
  baseUrl,
  specifier
}) => `baseUrl required to resolve relative specifier.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const tryUrlResolution = (string, url) => {
  const result = resolveUrl(string, url);
  return hasScheme(result) ? result : null;
};

const resolveSpecifier = (specifier, importer) => {
  if (specifier[0] === "/" || specifier.startsWith("./") || specifier.startsWith("../")) {
    return resolveUrl(specifier, importer);
  }

  if (hasScheme(specifier)) {
    return specifier;
  }

  return null;
};

const sortImportMap = importMap => {
  assertImportMap(importMap);
  const {
    imports,
    scopes
  } = importMap;
  return {
    imports: imports ? sortImports(imports) : undefined,
    scopes: scopes ? sortScopes(scopes) : undefined
  };
};
const sortImports = imports => {
  const importsSorted = {};
  Object.keys(imports).sort(compareLengthOrLocaleCompare).forEach(name => {
    importsSorted[name] = imports[name];
  });
  return importsSorted;
};
const sortScopes = scopes => {
  const scopesSorted = {};
  Object.keys(scopes).sort(compareLengthOrLocaleCompare).forEach(scopeName => {
    scopesSorted[scopeName] = sortImports(scopes[scopeName]);
  });
  return scopesSorted;
};

const compareLengthOrLocaleCompare = (a, b) => {
  return b.length - a.length || a.localeCompare(b);
};

const normalizeImportMap = (importMap, baseUrl) => {
  assertImportMap(importMap);

  if (typeof baseUrl !== "string") {
    throw new TypeError(formulateBaseUrlMustBeAString({
      baseUrl
    }));
  }

  const {
    imports,
    scopes
  } = importMap;
  return {
    imports: imports ? normalizeImports(imports, baseUrl) : undefined,
    scopes: scopes ? normalizeScopes(scopes, baseUrl) : undefined
  };
};

const normalizeImports = (imports, baseUrl) => {
  const importsNormalized = {};
  Object.keys(imports).forEach(specifier => {
    const address = imports[specifier];

    if (typeof address !== "string") {
      console.warn(formulateAddressMustBeAString({
        address,
        specifier
      }));
      return;
    }

    const specifierResolved = resolveSpecifier(specifier, baseUrl) || specifier;
    const addressUrl = tryUrlResolution(address, baseUrl);

    if (addressUrl === null) {
      console.warn(formulateAdressResolutionFailed({
        address,
        baseUrl,
        specifier
      }));
      return;
    }

    if (specifier.endsWith("/") && !addressUrl.endsWith("/")) {
      console.warn(formulateAddressUrlRequiresTrailingSlash({
        addressUrl,
        address,
        specifier
      }));
      return;
    }

    importsNormalized[specifierResolved] = addressUrl;
  });
  return sortImports(importsNormalized);
};

const normalizeScopes = (scopes, baseUrl) => {
  const scopesNormalized = {};
  Object.keys(scopes).forEach(scope => {
    const scopeValue = scopes[scope];
    const scopeUrl = tryUrlResolution(scope, baseUrl);

    if (scopeUrl === null) {
      console.warn(formulateScopeResolutionFailed({
        scope,
        baseUrl
      }));
      return;
    }

    const scopeValueNormalized = normalizeImports(scopeValue, baseUrl);
    scopesNormalized[scopeUrl] = scopeValueNormalized;
  });
  return sortScopes(scopesNormalized);
};

const formulateBaseUrlMustBeAString = ({
  baseUrl
}) => `baseUrl must be a string.
--- base url ---
${baseUrl}`;

const formulateAddressMustBeAString = ({
  specifier,
  address
}) => `Address must be a string.
--- address ---
${address}
--- specifier ---
${specifier}`;

const formulateAdressResolutionFailed = ({
  address,
  baseUrl,
  specifier
}) => `Address url resolution failed.
--- address ---
${address}
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`;

const formulateAddressUrlRequiresTrailingSlash = ({
  addressURL,
  address,
  specifier
}) => `Address must end with /.
--- address url ---
${addressURL}
--- address ---
${address}
--- specifier ---
${specifier}`;

const formulateScopeResolutionFailed = ({
  scope,
  baseUrl
}) => `Scope url resolution failed.
--- scope ---
${scope}
--- base url ---
${baseUrl}`;

const pathnameToExtension = pathname => {
  const slashLastIndex = pathname.lastIndexOf("/");

  if (slashLastIndex !== -1) {
    pathname = pathname.slice(slashLastIndex + 1);
  }

  const dotLastIndex = pathname.lastIndexOf(".");
  if (dotLastIndex === -1) return ""; // if (dotLastIndex === pathname.length - 1) return ""

  return pathname.slice(dotLastIndex);
};

const applyImportMap = ({
  importMap,
  specifier,
  importer
}) => {
  assertImportMap(importMap);

  if (typeof specifier !== "string") {
    throw new TypeError(writeSpecifierMustBeAString({
      specifier,
      importer
    }));
  }

  if (importer) {
    if (typeof importer !== "string") {
      throw new TypeError(writeImporterMustBeAString({
        importer,
        specifier
      }));
    }

    if (!hasScheme(importer)) {
      throw new Error(writeImporterMustBeAbsolute({
        importer,
        specifier
      }));
    }
  }

  const specifierUrl = resolveSpecifier(specifier, importer);
  const specifierNormalized = specifierUrl || specifier;
  const {
    scopes
  } = importMap;

  if (scopes && importer) {
    const scopeKeyMatching = Object.keys(scopes).find(scopeKey => {
      return scopeKey === importer || specifierIsPrefixOf(scopeKey, importer);
    });

    if (scopeKeyMatching) {
      const scopeValue = scopes[scopeKeyMatching];
      const remappingFromScopeImports = applyImports(specifierNormalized, scopeValue);

      if (remappingFromScopeImports !== null) {
        return remappingFromScopeImports;
      }
    }
  }

  const {
    imports
  } = importMap;

  if (imports) {
    const remappingFromImports = applyImports(specifierNormalized, imports);

    if (remappingFromImports !== null) {
      return remappingFromImports;
    }
  }

  if (specifierUrl) {
    return specifierUrl;
  }

  throw new Error(writeBareSpecifierMustBeRemapped({
    specifier,
    importer
  }));
};

const applyImports = (specifier, imports) => {
  const importKeyArray = Object.keys(imports);
  let i = 0;

  while (i < importKeyArray.length) {
    const importKey = importKeyArray[i];
    i++;

    if (importKey === specifier) {
      const importValue = imports[importKey];
      return importValue;
    }

    if (specifierIsPrefixOf(importKey, specifier)) {
      const importValue = imports[importKey];
      const afterImportKey = specifier.slice(importKey.length);
      return tryUrlResolution(afterImportKey, importValue);
    }
  }

  return null;
};

const specifierIsPrefixOf = (specifierHref, href) => {
  return specifierHref[specifierHref.length - 1] === "/" && href.startsWith(specifierHref);
};

const writeSpecifierMustBeAString = ({
  specifier,
  importer
}) => `specifier must be a string.
--- specifier ---
${specifier}
--- importer ---
${importer}`;

const writeImporterMustBeAString = ({
  importer,
  specifier
}) => `importer must be a string.
--- importer ---
${importer}
--- specifier ---
${specifier}`;

const writeImporterMustBeAbsolute = ({
  importer,
  specifier
}) => `importer must be an absolute url.
--- importer ---
${importer}
--- specifier ---
${specifier}`;

const writeBareSpecifierMustBeRemapped = ({
  specifier,
  importer
}) => `Unmapped bare specifier.
--- specifier ---
${specifier}
--- importer ---
${importer}`;

// directly target the files because this code
const resolveImport = ({
  specifier,
  importer,
  importMap,
  defaultExtension = true
}) => {
  return applyDefaultExtension({
    url: importMap ? applyImportMap({
      importMap,
      specifier,
      importer
    }) : resolveUrl(specifier, importer),
    importer,
    defaultExtension
  });
};

const applyDefaultExtension = ({
  url,
  importer,
  defaultExtension
}) => {
  if (hrefToPathname(url) === "/") {
    return url;
  }

  if (url.endsWith("/")) {
    return url;
  }

  if (typeof defaultExtension === "string") {
    const extension = pathnameToExtension(url);

    if (extension === "") {
      return `${url}${defaultExtension}`;
    }

    return url;
  }

  if (defaultExtension === true) {
    const extension = pathnameToExtension(url);

    if (extension === "" && importer) {
      const importerPathname = hrefToPathname(importer);
      const importerExtension = pathnameToExtension(importerPathname);
      return `${url}${importerExtension}`;
    }
  }

  return url;
};

// eslint-disable-next-line import/no-unresolved
const nodeRequire = require;
const filenameContainsBackSlashes = __filename.indexOf("\\") > -1;
const url = filenameContainsBackSlashes ? `file://${__filename.replace(/\\/g, "/")}` : `file://${__filename}`;

const assertUrlLike = (value, name = "url") => {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a url string, got ${value}`);
  }

  if (isWindowsPathnameSpecifier(value)) {
    throw new TypeError(`${name} must be a url but looks like a windows pathname, got ${value}`);
  }

  if (!hasScheme$1(value)) {
    throw new TypeError(`${name} must be a url and no scheme found, got ${value}`);
  }
};

const isWindowsPathnameSpecifier = specifier => {
  const firstChar = specifier[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = specifier[1];
  if (secondChar !== ":") return false;
  const thirdChar = specifier[2];
  return thirdChar === "/";
};

const hasScheme$1 = specifier => /^[a-zA-Z]+:/.test(specifier);

// https://git-scm.com/docs/gitignore
const applySpecifierPatternMatching = ({
  specifier,
  url,
  ...rest
} = {}) => {
  assertUrlLike(specifier, "specifier");
  assertUrlLike(url, "url");

  if (Object.keys(rest).length) {
    throw new Error(`received more parameters than expected.
--- name of unexpected parameters ---
${Object.keys(rest)}
--- name of expected parameters ---
specifier, url`);
  }

  return applyPatternMatching(specifier, url);
};

const applyPatternMatching = (pattern, string) => {
  let patternIndex = 0;
  let index = 0;
  let remainingPattern = pattern;
  let remainingString = string; // eslint-disable-next-line no-constant-condition

  while (true) {
    // pattern consumed and string consumed
    if (remainingPattern === "" && remainingString === "") {
      // pass because string fully matched pattern
      return pass({
        patternIndex,
        index
      });
    } // pattern consumed, string not consumed


    if (remainingPattern === "" && remainingString !== "") {
      // fails because string longer than expected
      return fail({
        patternIndex,
        index
      });
    } // from this point pattern is not consumed
    // string consumed, pattern not consumed


    if (remainingString === "") {
      // pass because trailing "**" is optional
      if (remainingPattern === "**") {
        return pass({
          patternIndex: patternIndex + 2,
          index
        });
      } // fail because string shorted than expected


      return fail({
        patternIndex,
        index
      });
    } // from this point pattern and string are not consumed
    // fast path trailing slash


    if (remainingPattern === "/") {
      // pass because trailing slash matches remaining
      return pass({
        patternIndex: patternIndex + 1,
        index: string.length
      });
    } // fast path trailing '**'


    if (remainingPattern === "**") {
      // pass because trailing ** matches remaining
      return pass({
        patternIndex: patternIndex + 2,
        index: string.length
      });
    } // pattern leading **


    if (remainingPattern.slice(0, 2) === "**") {
      // consumes "**"
      remainingPattern = remainingPattern.slice(2);
      patternIndex += 2;

      if (remainingPattern[0] === "/") {
        // consumes "/"
        remainingPattern = remainingPattern.slice(1);
        patternIndex += 1;
      } // pattern ending with ** always match remaining string


      if (remainingPattern === "") {
        return pass({
          patternIndex,
          index: string.length
        });
      }

      const skipResult = skipUntilMatch({
        pattern: remainingPattern,
        string: remainingString
      });

      if (!skipResult.matched) {
        return fail({
          patternIndex: patternIndex + skipResult.patternIndex,
          index: index + skipResult.index
        });
      }

      return pass({
        patternIndex: pattern.length,
        index: string.length
      });
    }

    if (remainingPattern[0] === "*") {
      // consumes "*"
      remainingPattern = remainingPattern.slice(1);
      patternIndex += 1; // la c'est plus délicat, il faut que remainingString
      // ne soit composé que de truc !== '/'

      if (remainingPattern === "") {
        const slashIndex = remainingString.indexOf("/");

        if (slashIndex > -1) {
          return fail({
            patternIndex,
            index: index + slashIndex
          });
        }

        return pass({
          patternIndex,
          index: string.length
        });
      } // the next char must not the one expected by remainingPattern[0]
      // because * is greedy and expect to skip one char


      if (remainingPattern[0] === remainingString[0]) {
        return fail({
          patternIndex: patternIndex - "*".length,
          index
        });
      }

      const skipResult = skipUntilMatch({
        pattern: remainingPattern,
        string: remainingString,
        skippablePredicate: remainingString => remainingString[0] !== "/"
      });

      if (!skipResult.matched) {
        return fail({
          patternIndex: patternIndex + skipResult.patternIndex,
          index: index + skipResult.index
        });
      }

      return pass({
        patternIndex: pattern.length,
        index: string.length
      });
    }

    if (remainingPattern[0] !== remainingString[0]) {
      return fail({
        patternIndex,
        index
      });
    } // consumes next char


    remainingPattern = remainingPattern.slice(1);
    remainingString = remainingString.slice(1);
    patternIndex += 1;
    index += 1;
    continue;
  }
};

const skipUntilMatch = ({
  pattern,
  string,
  skippablePredicate = () => true
}) => {
  let index = 0;
  let remainingString = string;
  let bestMatch = null; // eslint-disable-next-line no-constant-condition

  while (true) {
    const matchAttempt = applyPatternMatching(pattern, remainingString);

    if (matchAttempt.matched) {
      bestMatch = matchAttempt;
      break;
    }

    const skippable = skippablePredicate(remainingString);
    bestMatch = fail({
      patternIndex: bestMatch ? Math.max(bestMatch.patternIndex, matchAttempt.patternIndex) : matchAttempt.patternIndex,
      index: index + matchAttempt.index
    });

    if (!skippable) {
      break;
    } // search against the next unattempted string


    remainingString = remainingString.slice(matchAttempt.index + 1);
    index += matchAttempt.index + 1;

    if (remainingString === "") {
      bestMatch = { ...bestMatch,
        index: string.length
      };
      break;
    }

    continue;
  }

  return bestMatch;
};

const pass = ({
  patternIndex,
  index
}) => {
  return {
    matched: true,
    index,
    patternIndex
  };
};

const fail = ({
  patternIndex,
  index
}) => {
  return {
    matched: false,
    index,
    patternIndex
  };
};

const isPlainObject = value => {
  if (value === null) {
    return false;
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return false;
    }

    return true;
  }

  return false;
};

const metaMapToSpecifierMetaMap = (metaMap, ...rest) => {
  if (!isPlainObject(metaMap)) {
    throw new TypeError(`metaMap must be a plain object, got ${metaMap}`);
  }

  if (rest.length) {
    throw new Error(`received more arguments than expected.
--- number of arguments received ---
${1 + rest.length}
--- number of arguments expected ---
1`);
  }

  const specifierMetaMap = {};
  Object.keys(metaMap).forEach(metaKey => {
    const specifierValueMap = metaMap[metaKey];

    if (!isPlainObject(specifierValueMap)) {
      throw new TypeError(`metaMap value must be plain object, got ${specifierValueMap} for ${metaKey}`);
    }

    Object.keys(specifierValueMap).forEach(specifier => {
      const metaValue = specifierValueMap[specifier];
      const meta = {
        [metaKey]: metaValue
      };
      specifierMetaMap[specifier] = specifier in specifierMetaMap ? { ...specifierMetaMap[specifier],
        ...meta
      } : meta;
    });
  });
  return specifierMetaMap;
};

const assertSpecifierMetaMap = value => {
  if (!isPlainObject(value)) {
    throw new TypeError(`specifierMetaMap must be a plain object, got ${value}`);
  } // we could ensure it's key/value pair of url like key/object or null values

};

const normalizeSpecifierMetaMap = (specifierMetaMap, url, ...rest) => {
  assertSpecifierMetaMap(specifierMetaMap);
  assertUrlLike(url, "url");

  if (rest.length) {
    throw new Error(`received more arguments than expected.
--- number of arguments received ---
${2 + rest.length}
--- number of arguments expected ---
2`);
  }

  const specifierMetaMapNormalized = {};
  Object.keys(specifierMetaMap).forEach(specifier => {
    const specifierResolved = String(new URL(specifier, url));
    specifierMetaMapNormalized[specifierResolved] = specifierMetaMap[specifier];
  });
  return specifierMetaMapNormalized;
};

const urlCanContainsMetaMatching = ({
  url,
  specifierMetaMap,
  predicate,
  ...rest
}) => {
  assertUrlLike(url, "url"); // the function was meants to be used on url ending with '/'

  if (!url.endsWith("/")) {
    throw new Error(`url should end with /, got ${url}`);
  }

  assertSpecifierMetaMap(specifierMetaMap);

  if (typeof predicate !== "function") {
    throw new TypeError(`predicate must be a function, got ${predicate}`);
  }

  if (Object.keys(rest).length) {
    throw new Error(`received more parameters than expected.
--- name of unexpected parameters ---
${Object.keys(rest)}
--- name of expected parameters ---
url, specifierMetaMap, predicate`);
  } // for full match we must create an object to allow pattern to override previous ones


  let fullMatchMeta = {};
  let someFullMatch = false; // for partial match, any meta satisfying predicate will be valid because
  // we don't know for sure if pattern will still match for a file inside pathname

  const partialMatchMetaArray = [];
  Object.keys(specifierMetaMap).forEach(specifier => {
    const meta = specifierMetaMap[specifier];
    const {
      matched,
      index
    } = applySpecifierPatternMatching({
      specifier,
      url
    });

    if (matched) {
      someFullMatch = true;
      fullMatchMeta = { ...fullMatchMeta,
        ...meta
      };
    } else if (someFullMatch === false && index >= url.length) {
      partialMatchMetaArray.push(meta);
    }
  });

  if (someFullMatch) {
    return Boolean(predicate(fullMatchMeta));
  }

  return partialMatchMetaArray.some(partialMatchMeta => predicate(partialMatchMeta));
};

const urlToMeta = ({
  url,
  specifierMetaMap,
  ...rest
} = {}) => {
  assertUrlLike(url);
  assertSpecifierMetaMap(specifierMetaMap);

  if (Object.keys(rest).length) {
    throw new Error(`received more parameters than expected.
--- name of unexpected parameters ---
${Object.keys(rest)}
--- name of expected parameters ---
url, specifierMetaMap`);
  }

  return Object.keys(specifierMetaMap).reduce((previousMeta, specifier) => {
    const {
      matched
    } = applySpecifierPatternMatching({
      specifier,
      url
    });

    if (matched) {
      return { ...previousMeta,
        ...specifierMetaMap[specifier]
      };
    }

    return previousMeta;
  }, {});
};

const pathToDirectoryUrl = path => {
  const directoryUrl = path.startsWith("file://") ? path : String(url$2.pathToFileURL(path));

  if (directoryUrl.endsWith("/")) {
    return directoryUrl;
  }

  return `${directoryUrl}/`;
};
const pathToFileUrl = path => {
  return path.startsWith("file://") ? path : String(url$2.pathToFileURL(path));
};
const fileUrlToPath = fileUrl => {
  return url$2.fileURLToPath(fileUrl);
};
const resolveDirectoryUrl = (specifier, baseUrl) => {
  const directoryUrl = String(new URL(specifier, baseUrl));

  if (directoryUrl.endsWith("/")) {
    return directoryUrl;
  }

  return `${directoryUrl}/`;
};
const fileUrlToRelativePath = (fileUrl, baseFileUrl) => {
  // https://stackoverflow.com/a/31024574/2634179
  const fromPath = baseFileUrl.endsWith("/") ? fileUrlToPath(baseFileUrl) : path.dirname(fileUrlToPath(baseFileUrl));
  const toPath = fileUrlToPath(fileUrl);
  const relativePath = path.relative(fromPath, toPath);
  return relativePath;
};
const hasScheme$2 = string => {
  return /^[a-zA-Z]{2,}:/.test(string);
};
const urlToRelativeUrl = (url, baseUrl) => {
  if (typeof baseUrl !== "string") {
    throw new TypeError(`baseUrl must be a string, got ${baseUrl}`);
  }

  if (url.startsWith(baseUrl)) {
    // we should take into account only pathname
    // and ignore search params
    return url.slice(baseUrl.length);
  }

  return url;
};
const resolveUrl$1 = (specifier, baseUrl) => {
  if (typeof baseUrl === "undefined") {
    throw new TypeError(`baseUrl missing`);
  }

  return String(new URL(specifier, baseUrl));
};
const sameOrigin = (url, otherUrl) => {
  return new URL(url).origin === new URL(otherUrl).origin;
};

/* eslint-disable */
// https://github.com/babel/babel/tree/master/packages/babel-plugin-transform-modules-systemjs
const {
  template,
  types: t
} = nodeRequire("@babel/core");

const {
  declare
} = nodeRequire("@babel/helper-plugin-utils");

const {
  default: hoistVariables
} = nodeRequire("@babel/helper-hoist-variables");

const buildTemplate = template(`
  SYSTEM_REGISTER(MODULE_NAME, SOURCES, function (EXPORT_IDENTIFIER, CONTEXT_IDENTIFIER) {
    "use strict";
    BEFORE_BODY;
    return {
      setters: SETTERS,
      execute: EXECUTE
    };
  });
`);
const buildExportAll = template(`
  for (var KEY in TARGET) {
    if (KEY !== "default" && KEY !== "__esModule") EXPORT_OBJ[KEY] = TARGET[KEY];
  }
`);

function constructExportCall(path, exportIdent, exportNames, exportValues, exportStarTarget) {
  const statements = [];

  if (exportNames.length === 1) {
    statements.push(t.expressionStatement(t.callExpression(exportIdent, [t.stringLiteral(exportNames[0]), exportValues[0]]))); // eslint-disable-next-line no-negated-condition
  } else if (!exportStarTarget) {
    const objectProperties = [];

    for (let i = 0; i < exportNames.length; i++) {
      const exportName = exportNames[i];
      const exportValue = exportValues[i];
      objectProperties.push(t.objectProperty(t.identifier(exportName), exportValue));
    }

    statements.push(t.expressionStatement(t.callExpression(exportIdent, [t.objectExpression(objectProperties)])));
  } else {
    const exportObj = path.scope.generateUid("exportObj");
    statements.push(t.variableDeclaration("var", [t.variableDeclarator(t.identifier(exportObj), t.objectExpression([]))]));
    statements.push(buildExportAll({
      KEY: path.scope.generateUidIdentifier("key"),
      EXPORT_OBJ: t.identifier(exportObj),
      TARGET: exportStarTarget
    }));

    for (let i = 0; i < exportNames.length; i++) {
      const exportName = exportNames[i];
      const exportValue = exportValues[i];
      statements.push(t.expressionStatement(t.assignmentExpression("=", t.memberExpression(t.identifier(exportObj), t.identifier(exportName)), exportValue)));
    }

    statements.push(t.expressionStatement(t.callExpression(exportIdent, [t.identifier(exportObj)])));
  }

  return statements;
}

const TYPE_IMPORT = "Import";
var transformModulesSystemJs = declare((api, options) => {
  api.assertVersion(7);
  const {
    systemGlobal = "System"
  } = options;
  const IGNORE_REASSIGNMENT_SYMBOL = Symbol();
  const reassignmentVisitor = {
    "AssignmentExpression|UpdateExpression"(path) {
      if (path.node[IGNORE_REASSIGNMENT_SYMBOL]) return;
      path.node[IGNORE_REASSIGNMENT_SYMBOL] = true;
      const arg = path.get(path.isAssignmentExpression() ? "left" : "argument");

      if (arg.isObjectPattern() || arg.isArrayPattern()) {
        const exprs = [path.node];

        for (const name of Object.keys(arg.getBindingIdentifiers())) {
          if (this.scope.getBinding(name) !== path.scope.getBinding(name)) {
            return;
          }

          const exportedNames = this.exports[name];
          if (!exportedNames) return;

          for (const exportedName of exportedNames) {
            exprs.push(this.buildCall(exportedName, t.identifier(name)).expression);
          }
        }

        path.replaceWith(t.sequenceExpression(exprs));
        return;
      }

      if (!arg.isIdentifier()) return;
      const name = arg.node.name; // redeclared in this scope

      if (this.scope.getBinding(name) !== path.scope.getBinding(name)) return;
      const exportedNames = this.exports[name];
      if (!exportedNames) return;
      let node = path.node; // if it is a non-prefix update expression (x++ etc)
      // then we must replace with the expression (_export('x', x + 1), x++)
      // in order to ensure the same update expression value

      const isPostUpdateExpression = path.isUpdateExpression({
        prefix: false
      });

      if (isPostUpdateExpression) {
        node = t.binaryExpression(node.operator[0], t.unaryExpression("+", t.cloneNode(node.argument)), t.numericLiteral(1));
      }

      for (const exportedName of exportedNames) {
        node = this.buildCall(exportedName, node).expression;
      }

      if (isPostUpdateExpression) {
        node = t.sequenceExpression([node, path.node]);
      }

      path.replaceWith(node);
    }

  };
  return {
    name: "transform-modules-systemjs",
    visitor: {
      CallExpression(path, state) {
        if (path.node.callee.type === TYPE_IMPORT) {
          path.replaceWith(t.callExpression(t.memberExpression(t.identifier(state.contextIdent), t.identifier("import")), path.node.arguments));
        }
      },

      MetaProperty(path, state) {
        if (path.node.meta.name === "import" && path.node.property.name === "meta") {
          path.replaceWith(t.memberExpression(t.identifier(state.contextIdent), t.identifier("meta")));
        }
      },

      ReferencedIdentifier(path, state) {
        if (path.node.name === "__moduleName" && !path.scope.hasBinding("__moduleName")) {
          path.replaceWith(t.memberExpression(t.identifier(state.contextIdent), t.identifier("id")));
        }
      },

      Program: {
        enter(path, state) {
          state.contextIdent = path.scope.generateUid("context");
        },

        exit(path, state) {
          const undefinedIdent = path.scope.buildUndefinedNode();
          const exportIdent = path.scope.generateUid("export");
          const contextIdent = state.contextIdent;
          const exportMap = Object.create(null);
          const modules = [];
          let beforeBody = [];
          const setters = [];
          const sources = [];
          const variableIds = [];
          const removedPaths = [];

          function addExportName(key, val) {
            exportMap[key] = exportMap[key] || [];
            exportMap[key].push(val);
          }

          function pushModule(source, key, specifiers) {
            let module;
            modules.forEach(function (m) {
              if (m.key === source) {
                module = m;
              }
            });

            if (!module) {
              modules.push(module = {
                key: source,
                imports: [],
                exports: []
              });
            }

            module[key] = module[key].concat(specifiers);
          }

          function buildExportCall(name, val) {
            return t.expressionStatement(t.callExpression(t.identifier(exportIdent), [t.stringLiteral(name), val]));
          }

          const exportNames = [];
          const exportValues = [];
          const body = path.get("body");

          for (const path of body) {
            if (path.isFunctionDeclaration()) {
              beforeBody.push(path.node);
              removedPaths.push(path);
            } else if (path.isClassDeclaration()) {
              variableIds.push(path.node.id);
              path.replaceWith(t.expressionStatement(t.assignmentExpression("=", t.cloneNode(path.node.id), t.toExpression(path.node))));
            } else if (path.isImportDeclaration()) {
              const source = path.node.source.value;
              pushModule(source, "imports", path.node.specifiers);

              for (const name of Object.keys(path.getBindingIdentifiers())) {
                path.scope.removeBinding(name);
                variableIds.push(t.identifier(name));
              }

              path.remove();
            } else if (path.isExportAllDeclaration()) {
              pushModule(path.node.source.value, "exports", path.node);
              path.remove();
            } else if (path.isExportDefaultDeclaration()) {
              const declar = path.get("declaration");
              const id = declar.node.id;

              if (declar.isClassDeclaration()) {
                if (id) {
                  exportNames.push("default");
                  exportValues.push(undefinedIdent);
                  variableIds.push(id);
                  addExportName(id.name, "default");
                  path.replaceWith(t.expressionStatement(t.assignmentExpression("=", t.cloneNode(id), t.toExpression(declar.node))));
                } else {
                  exportNames.push("default");
                  exportValues.push(t.toExpression(declar.node));
                  removedPaths.push(path);
                }
              } else if (declar.isFunctionDeclaration()) {
                if (id) {
                  beforeBody.push(declar.node);
                  exportNames.push("default");
                  exportValues.push(t.cloneNode(id));
                  addExportName(id.name, "default");
                } else {
                  exportNames.push("default");
                  exportValues.push(t.toExpression(declar.node));
                }

                removedPaths.push(path);
              } else {
                path.replaceWith(buildExportCall("default", declar.node));
              }
            } else if (path.isExportNamedDeclaration()) {
              const declar = path.get("declaration");

              if (declar.node) {
                path.replaceWith(declar);

                if (path.isFunction()) {
                  const node = declar.node;
                  const name = node.id.name;
                  addExportName(name, name);
                  beforeBody.push(node);
                  exportNames.push(name);
                  exportValues.push(t.cloneNode(node.id));
                  removedPaths.push(path);
                } else if (path.isClass()) {
                  const name = declar.node.id.name;
                  exportNames.push(name);
                  exportValues.push(undefinedIdent);
                  variableIds.push(declar.node.id);
                  path.replaceWith(t.expressionStatement(t.assignmentExpression("=", t.cloneNode(declar.node.id), t.toExpression(declar.node))));
                  addExportName(name, name);
                } else {
                  for (const name of Object.keys(declar.getBindingIdentifiers())) {
                    addExportName(name, name);
                  }
                }
              } else {
                const specifiers = path.node.specifiers;

                if (specifiers && specifiers.length) {
                  if (path.node.source) {
                    pushModule(path.node.source.value, "exports", specifiers);
                    path.remove();
                  } else {
                    const nodes = [];

                    for (const specifier of specifiers) {
                      const binding = path.scope.getBinding(specifier.local.name); // hoisted function export

                      if (binding && t.isFunctionDeclaration(binding.path.node)) {
                        exportNames.push(specifier.exported.name);
                        exportValues.push(t.cloneNode(specifier.local));
                      } // only globals also exported this way
                      else if (!binding) {
                          nodes.push(buildExportCall(specifier.exported.name, specifier.local));
                        }

                      addExportName(specifier.local.name, specifier.exported.name);
                    }

                    path.replaceWithMultiple(nodes);
                  }
                }
              }
            }
          }

          modules.forEach(function (specifiers) {
            let setterBody = [];
            const target = path.scope.generateUid(specifiers.key);

            for (let specifier of specifiers.imports) {
              if (t.isImportNamespaceSpecifier(specifier)) {
                setterBody.push(t.expressionStatement(t.assignmentExpression("=", specifier.local, t.identifier(target))));
              } else if (t.isImportDefaultSpecifier(specifier)) {
                specifier = t.importSpecifier(specifier.local, t.identifier("default"));
              }

              if (t.isImportSpecifier(specifier)) {
                setterBody.push(t.expressionStatement(t.assignmentExpression("=", specifier.local, t.memberExpression(t.identifier(target), specifier.imported))));
              }
            }

            if (specifiers.exports.length) {
              const exportNames = [];
              const exportValues = [];
              let hasExportStar = false;

              for (const node of specifiers.exports) {
                if (t.isExportAllDeclaration(node)) {
                  hasExportStar = true;
                } else if (t.isExportSpecifier(node)) {
                  exportNames.push(node.exported.name);
                  exportValues.push(t.memberExpression(t.identifier(target), node.local));
                }
              }

              setterBody = setterBody.concat(constructExportCall(path, t.identifier(exportIdent), exportNames, exportValues, hasExportStar ? t.identifier(target) : null));
            }

            sources.push(t.stringLiteral(specifiers.key));
            setters.push(t.functionExpression(null, [t.identifier(target)], t.blockStatement(setterBody)));
          });
          let moduleName = this.getModuleName();
          if (moduleName) moduleName = t.stringLiteral(moduleName);
          hoistVariables(path, (id, name, hasInit) => {
            variableIds.push(id);

            if (!hasInit) {
              exportNames.push(name);
              exportValues.push(undefinedIdent);
            }
          }, null);

          if (variableIds.length) {
            beforeBody.unshift(t.variableDeclaration("var", variableIds.map(id => t.variableDeclarator(id))));
          }

          if (exportNames.length) {
            beforeBody = beforeBody.concat(constructExportCall(path, t.identifier(exportIdent), exportNames, exportValues, null));
          }

          path.traverse(reassignmentVisitor, {
            exports: exportMap,
            buildCall: buildExportCall,
            scope: path.scope
          });

          for (const path of removedPaths) {
            path.remove();
          }

          path.node.body = [buildTemplate({
            SYSTEM_REGISTER: t.memberExpression(t.identifier(systemGlobal), t.identifier("register")),
            BEFORE_BODY: beforeBody,
            MODULE_NAME: moduleName,
            SETTERS: t.arrayExpression(setters),
            SOURCES: t.arrayExpression(sources),
            EXECUTE: t.functionExpression(null, [], t.blockStatement(path.node.body), false, options.topLevelAwait && programUsesTopLevelAwait(path)),
            EXPORT_IDENTIFIER: t.identifier(exportIdent),
            CONTEXT_IDENTIFIER: t.identifier(contextIdent)
          })];
        }

      }
    }
  };
});

const programUsesTopLevelAwait = path => {
  let hasTopLevelAwait = false;
  path.traverse({
    AwaitExpression(path) {
      const parent = path.getFunctionParent();
      if (!parent || parent.type === "Program") hasTopLevelAwait = true;
    }

  });
  return hasTopLevelAwait;
};

const findAsyncPluginNameInBabelPluginMap = babelPluginMap => {
  if ("transform-async-to-promises" in babelPluginMap) {
    return "transform-async-to-promises";
  }

  if ("transform-async-to-generator" in babelPluginMap) {
    return "transform-async-to-generator";
  }

  return "";
};

// https://github.com/rburns/ansi-to-html/blob/master/src/ansi_to_html.js
// https://github.com/drudru/ansi_up/blob/master/ansi_up.js
const Convert = nodeRequire("ansi-to-html");

const ansiToHTML = ansiString => {
  return new Convert().toHtml(ansiString);
};

const {
  addSideEffect
} = nodeRequire("@babel/helper-module-imports");

const ensureRegeneratorRuntimeImportBabelPlugin = (api, options) => {
  api.assertVersion(7);
  const {
    regeneratorRuntimeIdentifierName = "regeneratorRuntime",
    regeneratorRuntimeImportPath = "@jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js"
  } = options;
  return {
    visitor: {
      Identifier(path, opts) {
        const {
          filename
        } = opts;
        const filepathname = filename.replace(/\\/g, "/");

        if (filepathname.endsWith("node_modules/regenerator-runtime/runtime.js")) {
          return;
        }

        const {
          node
        } = path;

        if (node.name === regeneratorRuntimeIdentifierName) {
          addSideEffect(path.scope.getProgramParent().path, regeneratorRuntimeImportPath);
        }
      }

    }
  };
};

const {
  addSideEffect: addSideEffect$1
} = nodeRequire("@babel/helper-module-imports");

const ensureGlobalThisImportBabelPlugin = (api, options) => {
  api.assertVersion(7);
  const {
    globalThisIdentifierName = "globalThis",
    globalThisImportPath = "@jsenv/core/helpers/global-this/global-this.js"
  } = options;
  return {
    visitor: {
      Identifier(path, opts) {
        const {
          filename
        } = opts;
        const filepathname = filename.replace(/\\/g, "/");

        if (filepathname.endsWith("/helpers/global-this/global-this.js")) {
          return;
        }

        const {
          node
        } = path;

        if (node.name === globalThisIdentifierName) {
          addSideEffect$1(path.scope.getProgramParent().path, globalThisImportPath);
        }
      }

    }
  };
};

const {
  list
} = nodeRequire("@babel/helpers");

const babelHelperNameInsideJsenvCoreArray = ["applyDecoratedDescriptor", "arrayWithHoles", "arrayWithoutHoles", "assertThisInitialized", "AsyncGenerator", "asyncGeneratorDelegate", "asyncIterator", "asyncToGenerator", "awaitAsyncGenerator", "AwaitValue", "classCallCheck", "classNameTDZError", "classPrivateFieldDestructureSet", "classPrivateFieldGet", "classPrivateFieldLooseBase", "classPrivateFieldLooseKey", "classPrivateFieldSet", "classPrivateMethodGet", "classPrivateMethodSet", "classStaticPrivateFieldSpecGet", "classStaticPrivateFieldSpecSet", "classStaticPrivateMethodGet", "classStaticPrivateMethodSet", "construct", "createClass", "decorate", "defaults", "defineEnumerableProperties", "defineProperty", "extends", "get", "getPrototypeOf", "inherits", "inheritsLoose", "initializerDefineProperty", "initializerWarningHelper", "instanceof", "interopRequireDefault", "interopRequireWildcard", "isNativeFunction", "iterableToArray", "iterableToArrayLimit", "iterableToArrayLimitLoose", "jsx", "newArrowCheck", "nonIterableRest", "nonIterableSpread", "objectDestructuringEmpty", "objectSpread", "objectSpread2", "objectWithoutProperties", "objectWithoutPropertiesLoose", "possibleConstructorReturn", "readOnlyError", "set", "setPrototypeOf", "skipFirstGeneratorNext", "slicedToArray", "slicedToArrayLoose", "superPropBase", "taggedTemplateLiteral", "taggedTemplateLiteralLoose", "tdz", "temporalRef", "temporalUndefined", "toArray", "toConsumableArray", "toPrimitive", "toPropertyKey", "typeof", "wrapAsyncGenerator", "wrapNativeSuper", "wrapRegExp"];
const babelHelperScope = "@jsenv/core/helpers/babel/"; // maybe we can put back / in front of .jsenv here because we will
// "redirect" or at least transform everything inside .jsenv
// not only everything inside .dist

const babelHelperAbstractScope = `.jsenv/helpers/babel/`;
const babelHelperNameToImportSpecifier = babelHelperName => {
  if (babelHelperNameInsideJsenvCoreArray.includes(babelHelperName)) {
    return `${babelHelperScope}${babelHelperName}/${babelHelperName}.js`;
  }

  return `${babelHelperAbstractScope}${babelHelperName}/${babelHelperName}.js`;
};
const filePathToBabelHelperName = filePath => {
  const fileUrl = pathToFileUrl(filePath);
  const babelHelperPrefix = "core/helpers/babel/";

  if (fileUrl.includes(babelHelperPrefix)) {
    const afterBabelHelper = fileUrl.slice(fileUrl.indexOf(babelHelperPrefix) + babelHelperPrefix.length);
    return afterBabelHelper.slice(0, afterBabelHelper.indexOf("/"));
  }

  if (fileUrl.includes(babelHelperAbstractScope)) {
    const afterBabelHelper = fileUrl.slice(fileUrl.indexOf(babelHelperAbstractScope) + babelHelperAbstractScope.length);
    return afterBabelHelper.slice(0, afterBabelHelper.indexOf("/"));
  }

  return null;
};

const {
  addDefault
} = nodeRequire("@babel/helper-module-imports"); // named import approach found here:
// https://github.com/rollup/rollup-plugin-babel/blob/18e4232a450f320f44c651aa8c495f21c74d59ac/src/helperPlugin.js#L1
// for reference this is how it's done to reference
// a global babel helper object instead of using
// a named import
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-plugin-external-helpers/src/index.js


const transformBabelHelperToImportBabelPlugin = api => {
  api.assertVersion(7);
  return {
    pre: file => {
      const cachedHelpers = {};
      file.set("helperGenerator", name => {
        // the list of possible helpers name
        // https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
        if (!file.availableHelper(name)) {
          return undefined;
        }

        if (cachedHelpers[name]) {
          return cachedHelpers[name];
        }

        const filePath = file.opts.filename;
        const babelHelperImportSpecifier = babelHelperNameToImportSpecifier(name);

        if (filePathToBabelHelperName(filePath) === name) {
          return undefined;
        }

        const helper = addDefault(file.path, babelHelperImportSpecifier, {
          nameHint: `_${name}`
        });
        cachedHelpers[name] = helper;
        return helper;
      });
    }
  };
};

const {
  transformAsync,
  transformFromAstAsync
} = nodeRequire("@babel/core");

const syntaxDynamicImport = nodeRequire("@babel/plugin-syntax-dynamic-import");

const syntaxImportMeta = nodeRequire("@babel/plugin-syntax-import-meta");

const defaultBabelPluginArray = [syntaxDynamicImport, syntaxImportMeta];
const jsenvTransform = async ({
  inputCode,
  inputPath,
  inputRelativePath,
  inputAst,
  inputMap,
  babelPluginMap,
  allowTopLevelAwait,
  transformTopLevelAwait,
  transformModuleIntoSystemFormat,
  transformGenerator,
  transformGlobalThis,
  regeneratorRuntimeImportPath,
  remap
}) => {
  // https://babeljs.io/docs/en/options
  const options = {
    filename: inputPath,
    filenameRelative: inputRelativePath,
    inputSourceMap: inputMap,
    configFile: false,
    babelrc: false,
    // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: remap,
    sourceFileName: inputPath,
    // https://babeljs.io/docs/en/options#parseropts
    parserOpts: {
      allowAwaitOutsideFunction: allowTopLevelAwait
    }
  };
  const babelHelperName = filePathToBabelHelperName(inputPath); // to prevent typeof circular dependency

  if (babelHelperName === "typeof") {
    const babelPluginMapWithoutTransformTypeOf = {};
    Object.keys(babelPluginMap).forEach(key => {
      if (key !== "transform-typeof-symbol") {
        babelPluginMapWithoutTransformTypeOf[key] = babelPluginMap[key];
      }
    });
    babelPluginMap = babelPluginMapWithoutTransformTypeOf;
  }

  if (transformGenerator) {
    babelPluginMap = { ...babelPluginMap,
      "ensure-regenerator-runtime-import": [ensureRegeneratorRuntimeImportBabelPlugin, {
        regeneratorRuntimeImportPath
      }]
    };
  }

  if (transformGlobalThis) {
    babelPluginMap = { ...babelPluginMap,
      "ensure-global-this-import": [ensureGlobalThisImportBabelPlugin]
    };
  }

  babelPluginMap = { ...babelPluginMap,
    "transform-babel-helpers-to-import": [transformBabelHelperToImportBabelPlugin]
  };
  const asyncPluginName = findAsyncPluginNameInBabelPluginMap(babelPluginMap);

  if (transformModuleIntoSystemFormat && transformTopLevelAwait && asyncPluginName) {
    const babelPluginArrayWithoutAsync = [];
    Object.keys(babelPluginMap).forEach(name => {
      if (name !== asyncPluginName) {
        babelPluginArrayWithoutAsync.push(babelPluginMap[name]);
      }
    }); // put body inside something like (async () => {})()

    const result = await babelTransform({
      ast: inputAst,
      code: inputCode,
      options: { ...options,
        plugins: [...defaultBabelPluginArray, ...babelPluginArrayWithoutAsync, [transformModulesSystemJs, {
          topLevelAwait: transformTopLevelAwait
        }]]
      }
    }); // we need to retranspile the await keywords now wrapped
    // inside Systemjs function.
    // They are ignored, at least by transform-async-to-promises
    // see https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/26

    const finalResult = await babelTransform({
      // ast: result.ast,
      code: result.code,
      options: { ...options,
        // about inputSourceMap see
        // https://github.com/babel/babel/blob/eac4c5bc17133c2857f2c94c1a6a8643e3b547a7/packages/babel-core/src/transformation/file/generate.js#L57
        // https://github.com/babel/babel/blob/090c364a90fe73d36a30707fc612ce037bdbbb24/packages/babel-core/src/transformation/file/merge-map.js#L6s
        inputSourceMap: result.map,
        plugins: [...defaultBabelPluginArray, babelPluginMap[asyncPluginName]]
      }
    });
    return { ...result,
      ...finalResult,
      metadata: { ...result.metadata,
        ...finalResult.metadata
      }
    };
  }

  const babelPluginArray = [...defaultBabelPluginArray, ...Object.keys(babelPluginMap).map(babelPluginName => babelPluginMap[babelPluginName]), ...(transformModuleIntoSystemFormat ? [[transformModulesSystemJs, {
    topLevelAwait: transformTopLevelAwait
  }]] : [])];
  const result = await babelTransform({
    ast: inputAst,
    code: inputCode,
    options: { ...options,
      plugins: babelPluginArray
    }
  });
  return result;
};

const babelTransform = async ({
  ast,
  code,
  options
}) => {
  try {
    if (ast) {
      const result = await transformFromAstAsync(ast, code, options);
      return result;
    }

    return await transformAsync(code, options);
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      const message = error.message;
      throw createParseError({
        message,
        messageHTML: ansiToHTML(message),
        filename: options.filename,
        lineNumber: error.loc.line,
        columnNumber: error.loc.column
      });
    }

    throw error;
  }
};

const createParseError = data => {
  const {
    message
  } = data;
  const parseError = new Error(message);
  parseError.code = "PARSE_ERROR";
  parseError.data = data;
  return parseError;
};

const transformJs = async ({
  projectDirectoryUrl,
  code,
  url,
  urlAfterTransform,
  map,
  babelPluginMap,
  convertMap = {},
  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,
  transformGenerator = true,
  transformGlobalThis = true,
  remap = true
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`);
  }

  if (typeof code !== "string") {
    throw new TypeError(`code must be a string, got ${code}`);
  }

  if (typeof url !== "string") {
    throw new TypeError(`url must be a string, got ${url}`);
  }

  const {
    inputCode,
    inputMap
  } = await computeInputCodeAndInputMap({
    code,
    url,
    urlAfterTransform,
    map,
    projectDirectoryUrl,
    convertMap,
    remap,
    allowTopLevelAwait
  });
  const inputPath = computeInputPath(url);
  const inputRelativePath = computeInputRelativePath(url, projectDirectoryUrl);
  return jsenvTransform({
    inputCode,
    inputMap,
    inputPath,
    inputRelativePath,
    babelPluginMap,
    convertMap,
    allowTopLevelAwait,
    transformTopLevelAwait,
    transformModuleIntoSystemFormat,
    transformGenerator,
    transformGlobalThis,
    remap
  });
};

const computeInputCodeAndInputMap = async ({
  code,
  url,
  urlAfterTransform,
  map,
  projectDirectoryUrl,
  convertMap,
  remap,
  allowTopLevelAwait
}) => {
  const specifierMetaMap = normalizeSpecifierMetaMap(metaMapToSpecifierMetaMap({
    convert: convertMap
  }), projectDirectoryUrl);
  const {
    convert
  } = urlToMeta({
    url,
    specifierMetaMap
  });

  if (!convert) {
    return {
      inputCode: code,
      inputMap: map
    };
  }

  if (typeof convert !== "function") {
    throw new TypeError(`convert must be a function, got ${convert}`);
  } // TODO: handle map when passed


  const conversionResult = await convert({
    projectDirectoryUrl,
    code,
    url,
    urlAfterTransform,
    map,
    remap,
    allowTopLevelAwait
  });

  if (typeof conversionResult !== "object") {
    throw new TypeError(`convert must return an object, got ${conversionResult}`);
  }

  const inputCode = conversionResult.code;

  if (typeof inputCode !== "string") {
    throw new TypeError(`convert must return { code } string, got { code: ${inputCode} } `);
  }

  const inputMap = conversionResult.map;
  return {
    inputCode,
    inputMap
  };
};

const computeInputPath = url => {
  if (url.startsWith("file://")) {
    return fileUrlToPath(url);
  }

  return url;
};

const computeInputRelativePath = (url, projectDirectoryUrl) => {
  if (url.startsWith(projectDirectoryUrl)) {
    return fileUrlToRelativePath(url, projectDirectoryUrl);
  }

  return undefined;
};

const transformCommonJs = nodeRequire("babel-plugin-transform-commonjs");

const convertCommonJsWithBabel = async ({
  projectDirectoryUrl,
  code,
  url,
  replaceGlobalObject = true,
  replaceGlobalFilename = true,
  replaceGlobalDirname = true,
  replaceProcessEnvNodeEnv = true,
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceMap = {}
}) => {
  // maybe we should use babel core here instead of transformJs
  const result = await transformJs({
    projectDirectoryUrl,
    code,
    url,
    babelPluginMap: {
      "transform-commonjs": [transformCommonJs],
      "transform-replace-expressions": [createReplaceExpressionsBabelPlugin({
        replaceMap: { ...(replaceProcessEnvNodeEnv ? {
            "process.env.NODE_ENV": `("${processEnvNodeEnv}")`
          } : {}),
          ...(replaceGlobalObject ? {
            global: "globalThis"
          } : {}),
          ...(replaceGlobalFilename ? {
            __filename: __filenameReplacement
          } : {}),
          ...(replaceGlobalDirname ? {
            __dirname: __dirnameReplacement
          } : {}),
          ...replaceMap
        }
      })]
    },
    transformModuleIntoSystemFormat: false
  });
  return result;
};
const __filenameReplacement = `import.meta.url.slice('file:///'.length)`;
const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`; // const createInlineProcessNodeEnvBabelPlugin = ({ value = process.env.NODE_ENV }) => {
//   return ({ types: t }) => {
//     return {
//       name: "inline-process-node-env",
//       visitor: {
//         MemberExpression(path) {
//           if (path.matchesPattern("process.env.NODE_ENV")) {
//             path.replaceWith(t.valueToNode(value))
//             if (path.parentPath.isBinaryExpression()) {
//               const evaluated = path.parentPath.evaluate()
//               if (evaluated.confident) {
//                 path.parentPath.replaceWith(t.valueToNode(evaluated.value))
//               }
//             }
//           }
//         },
//       },
//     }
//   }
// }
// heavily inspired from https://github.com/jviide/babel-plugin-transform-replace-expressions

const createReplaceExpressionsBabelPlugin = ({
  replaceMap = {},
  allowConflictingReplacements = false
} = {}) => {
  const replacementMap = new Map();
  const valueExpressionSet = new Set();
  return ({
    traverse,
    parse,
    types
  }) => {
    return {
      name: "replace-expressions",
      pre: state => {
        // https://github.com/babel/babel/blob/d50e78d45b608f6e0f6cc33aeb22f5db5027b153/packages/babel-traverse/src/path/replacement.js#L93
        const parseExpression = value => {
          const expressionNode = parse(value, state.opts).program.body[0].expression;
          traverse.removeProperties(expressionNode);
          return expressionNode;
        };

        Object.keys(replaceMap).forEach(key => {
          const keyExpressionNode = parseExpression(key);
          const candidateArray = replacementMap.get(keyExpressionNode.type) || [];
          const value = replaceMap[key];
          const valueExpressionNode = parseExpression(value);
          const equivalentKeyExpressionIndex = candidateArray.findIndex(candidate => types.isNodesEquivalent(candidate.keyExpressionNode, keyExpressionNode));

          if (!allowConflictingReplacements && equivalentKeyExpressionIndex > -1) {
            throw new Error(`Expressions ${candidateArray[equivalentKeyExpressionIndex].key} and ${key} conflict`);
          }

          const newCandidate = {
            key,
            value,
            keyExpressionNode,
            valueExpressionNode
          };

          if (equivalentKeyExpressionIndex > -1) {
            candidateArray[equivalentKeyExpressionIndex] = newCandidate;
          } else {
            candidateArray.push(newCandidate);
          }

          replacementMap.set(keyExpressionNode.type, candidateArray);
        });
        replacementMap.forEach(candidateArray => {
          candidateArray.forEach(candidate => {
            valueExpressionSet.add(candidate.valueExpressionNode);
          });
        });
      },
      visitor: {
        Expression(path) {
          if (valueExpressionSet.has(path.node)) {
            path.skip();
            return;
          }

          const candidateArray = replacementMap.get(path.node.type);

          if (!candidateArray) {
            return;
          }

          const candidateFound = candidateArray.find(candidate => {
            return types.isNodesEquivalent(candidate.keyExpressionNode, path.node);
          });

          if (candidateFound) {
            try {
              types.validate(path.parent, path.key, candidateFound.valueExpressionNode);
            } catch (err) {
              if (!(err instanceof TypeError)) {
                throw err;
              }

              path.skip();
              return;
            }

            path.replaceWith(candidateFound.valueExpressionNode);
            return;
          }
        }

      }
    };
  };
};

const commonjs = nodeRequire("rollup-plugin-commonjs");

const nodeResolve = nodeRequire("rollup-plugin-node-resolve");

const builtins = nodeRequire("rollup-plugin-node-builtins");

const createJSONRollupPlugin = nodeRequire("rollup-plugin-json");

const createNodeGlobalRollupPlugin = nodeRequire("rollup-plugin-node-globals");

const createReplaceRollupPlugin = nodeRequire("rollup-plugin-replace");

const {
  rollup
} = nodeRequire("rollup");

const convertCommonJsWithRollup = async ({
  url,
  urlAfterTransform,
  replaceGlobalObject = true,
  replaceGlobalFilename = true,
  replaceGlobalDirname = true,
  replaceProcessEnvNodeEnv = true,
  replaceProcess = true,
  replaceBuffer = true,
  processEnvNodeEnv = process.env.NODE_ENV,
  replaceMap = {},
  convertBuiltinsToBrowser = true,
  external = []
} = {}) => {
  if (!url.startsWith("file:///")) {
    // it's possible to make rollup compatible with http:// for instance
    // as we do in @jsenv/bundling
    // however it's an exotic use case for now
    throw new Error(`compatible only with file:// protocol, got ${url}`);
  }

  const filePath = fileUrlToPath(url);
  const nodeBuiltinsRollupPlugin = builtins();
  const nodeResolveRollupPlugin = nodeResolve({
    mainFields: ["main"]
  });
  const jsonRollupPlugin = createJSONRollupPlugin();
  const nodeGlobalRollupPlugin = createNodeGlobalRollupPlugin({
    global: false,
    // handled by replaceMap
    dirname: false,
    // handled by replaceMap
    filename: false,
    //  handled by replaceMap
    process: replaceProcess,
    buffer: replaceBuffer
  });
  const commonJsRollupPlugin = commonjs();
  const rollupBundle = await rollup({
    input: filePath,
    inlineDynamicImports: true,
    external,
    plugins: [commonJsRollupPlugin, createReplaceRollupPlugin({ ...(replaceProcessEnvNodeEnv ? {
        "process.env.NODE_ENV": JSON.stringify(processEnvNodeEnv)
      } : {}),
      ...(replaceGlobalObject ? {
        global: "globalThis"
      } : {}),
      ...(replaceGlobalFilename ? {
        __filename: __filenameReplacement$1
      } : {}),
      ...(replaceGlobalDirname ? {
        __dirname: __dirnameReplacement$1
      } : {}),
      ...replaceMap
    }), nodeGlobalRollupPlugin, ...(convertBuiltinsToBrowser ? [nodeBuiltinsRollupPlugin] : []), nodeResolveRollupPlugin, jsonRollupPlugin]
  });
  const generateOptions = {
    // https://rollupjs.org/guide/en#output-format
    format: "esm",
    // entryFileNames: `./[name].js`,
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources: true,
    ...(urlAfterTransform ? {
      dir: fileUrlToPath(resolveUrl$1("./", urlAfterTransform))
    } : {})
  };
  const result = await rollupBundle.generate(generateOptions);
  return result.output[0];
};
const __filenameReplacement$1 = `import.meta.url.slice('file:///'.length)`;
const __dirnameReplacement$1 = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`;

const createCancellationToken = () => {
  const register = callback => {
    if (typeof callback !== "function") {
      throw new Error(`callback must be a function, got ${callback}`);
    }

    return {
      callback,
      unregister: () => {}
    };
  };

  const throwIfRequested = () => undefined;

  return {
    register,
    cancellationRequested: false,
    throwIfRequested
  };
};

const memoizeOnce = compute => {
  let locked = false;
  let lockValue;

  const memoized = (...args) => {
    if (locked) return lockValue; // if compute is recursive wait for it to be fully done before storing the lockValue
    // so set locked later

    lockValue = compute(...args);
    locked = true;
    return lockValue;
  };

  memoized.deleteCache = () => {
    const value = lockValue;
    locked = false;
    lockValue = undefined;
    return value;
  };

  return memoized;
};

const createOperation = ({
  cancellationToken = createCancellationToken(),
  start,
  ...rest
}) => {
  const unknownArgumentNames = Object.keys(rest);

  if (unknownArgumentNames.length) {
    throw new Error(`createOperation called with unknown argument names.
--- unknown argument names ---
${unknownArgumentNames}
--- possible argument names ---
cancellationToken
start`);
  }

  cancellationToken.throwIfRequested();
  const promise = new Promise(resolve => {
    resolve(start());
  });
  const cancelPromise = new Promise((resolve, reject) => {
    const cancelRegistration = cancellationToken.register(cancelError => {
      cancelRegistration.unregister();
      reject(cancelError);
    });
    promise.then(cancelRegistration.unregister, () => {});
  });
  const operationPromise = Promise.race([promise, cancelPromise]);
  return operationPromise;
};

/*
We could pick from array like this

maxParallelExecution: 2
array: [a, b, c, d]

We could start [a,b]
And immediatly after a or b finish, start c
And immediatly after any finishes, start d

This approach try to maximize maxParallelExecution.
But it has one hidden disadvantage.

If the tasks can queue each other there is a chance that
a task gets constantly delayed by other started task
giving the false feeling that the task takes a long time
to be done.

To avoid this I prefer to start them chunk by chunk
so it means [a,b] and then [c,d] that will wait for a and b to complete

*/
const createConcurrentOperations = async ({
  cancellationToken = createCancellationToken(),
  concurrencyLimit = 5,
  array,
  start,
  ...rest
}) => {
  if (typeof concurrencyLimit !== "number") {
    throw new TypeError(`concurrencyLimit must be a number, got ${concurrencyLimit}`);
  }

  if (concurrencyLimit < 1) {
    throw new Error(`concurrencyLimit must be 1 or more, got ${concurrencyLimit}`);
  }

  if (typeof array !== "object") {
    throw new TypeError(`array must be an array, got ${array}`);
  }

  if (typeof start !== "function") {
    throw new TypeError(`start must be a function, got ${start}`);
  }

  const unknownArgumentNames = Object.keys(rest);

  if (unknownArgumentNames.length) {
    throw new Error(`createConcurrentOperations called with unknown argument names.
--- unknown argument names ---
${unknownArgumentNames}
--- possible argument names ---
cancellationToken
concurrencyLimit
array
start`);
  }

  const outputArray = [];
  let progressionIndex = 0;
  let remainingExecutionCount = array.length;

  const nextChunk = async () => {
    await createOperation({
      cancellationToken,
      start: async () => {
        const outputPromiseArray = [];

        while (remainingExecutionCount > 0 && outputPromiseArray.length < concurrencyLimit) {
          remainingExecutionCount--;
          const outputPromise = executeOne(progressionIndex);
          progressionIndex++;
          outputPromiseArray.push(outputPromise);
        }

        if (outputPromiseArray.length) {
          await Promise.all(outputPromiseArray);

          if (remainingExecutionCount > 0) {
            await nextChunk();
          }
        }
      }
    });
  };

  const executeOne = async index => {
    return createOperation({
      cancellationToken,
      start: async () => {
        const input = array[index];
        const output = await start(input);
        outputArray[index] = output;
      }
    });
  };

  await nextChunk();
  return outputArray;
};

const createStoppableOperation = ({
  cancellationToken = createCancellationToken(),
  start,
  stop,
  ...rest
}) => {
  if (typeof stop !== "function") {
    throw new TypeError(`stop must be a function. got ${stop}`);
  }

  const unknownArgumentNames = Object.keys(rest);

  if (unknownArgumentNames.length) {
    throw new Error(`createStoppableOperation called with unknown argument names.
--- unknown argument names ---
${unknownArgumentNames}
--- possible argument names ---
cancellationToken
start
stop`);
  }

  cancellationToken.throwIfRequested();
  const promise = new Promise(resolve => {
    resolve(start());
  });
  const cancelPromise = new Promise((resolve, reject) => {
    const cancelRegistration = cancellationToken.register(cancelError => {
      cancelRegistration.unregister();
      reject(cancelError);
    });
    promise.then(cancelRegistration.unregister, () => {});
  });
  const operationPromise = Promise.race([promise, cancelPromise]);
  const stopInternal = memoizeOnce(async reason => {
    const value = await promise;
    return stop(value, reason);
  });
  cancellationToken.register(stopInternal);
  operationPromise.stop = stopInternal;
  return operationPromise;
};

const firstOperationMatching = ({
  array,
  start,
  predicate
}) => {
  if (typeof array !== "object") {
    throw new TypeError(`array must be an object, got ${array}`);
  }

  if (typeof start !== "function") {
    throw new TypeError(`start must be a function, got ${start}`);
  }

  if (typeof predicate !== "function") {
    throw new TypeError(`predicate must be a function, got ${predicate}`);
  }

  return new Promise((resolve, reject) => {
    const visit = index => {
      if (index >= array.length) {
        return resolve();
      }

      const input = array[index];
      const returnValue = start(input);
      return Promise.resolve(returnValue).then(output => {
        if (predicate(output)) {
          return resolve(output);
        }

        return visit(index + 1);
      }, reject);
    };

    visit(0);
  });
};

const createCancelError = reason => {
  const cancelError = new Error(`canceled because ${reason}`);
  cancelError.name = "CANCEL_ERROR";
  cancelError.reason = reason;
  return cancelError;
};
const isCancelError = value => {
  return value && typeof value === "object" && value.name === "CANCEL_ERROR";
};
const errorToCancelReason = error => {
  if (!isCancelError(error)) return "";
  return error.reason;
};

const composeCancellationToken = (...tokens) => {
  const register = callback => {
    if (typeof callback !== "function") {
      throw new Error(`callback must be a function, got ${callback}`);
    }

    const registrationArray = [];

    const visit = i => {
      const token = tokens[i];
      const registration = token.register(callback);
      registrationArray.push(registration);
    };

    let i = 0;

    while (i < tokens.length) {
      visit(i++);
    }

    const compositeRegistration = {
      callback,
      unregister: () => {
        registrationArray.forEach(registration => registration.unregister());
        registrationArray.length = 0;
      }
    };
    return compositeRegistration;
  };

  let requested = false;
  let cancelError;
  const internalRegistration = register(parentCancelError => {
    requested = true;
    cancelError = parentCancelError;
    internalRegistration.unregister();
  });

  const throwIfRequested = () => {
    if (requested) {
      throw cancelError;
    }
  };

  return {
    register,

    get cancellationRequested() {
      return requested;
    },

    throwIfRequested
  };
};

const arrayWithout = (array, item) => {
  const arrayWithoutItem = [];
  let i = 0;

  while (i < array.length) {
    const value = array[i];
    i++;

    if (value === item) {
      continue;
    }

    arrayWithoutItem.push(value);
  }

  return arrayWithoutItem;
};

// https://github.com/tc39/proposal-cancellation/tree/master/stage0
const createCancellationSource = () => {
  let requested = false;
  let cancelError;
  let registrationArray = [];

  const cancel = reason => {
    if (requested) return;
    requested = true;
    cancelError = createCancelError(reason);
    const registrationArrayCopy = registrationArray.slice();
    registrationArray.length = 0;
    registrationArrayCopy.forEach(registration => {
      registration.callback(cancelError); // const removedDuringCall = registrationArray.indexOf(registration) === -1
    });
  };

  const register = callback => {
    if (typeof callback !== "function") {
      throw new Error(`callback must be a function, got ${callback}`);
    }

    const existingRegistration = registrationArray.find(registration => {
      return registration.callback === callback;
    }); // don't register twice

    if (existingRegistration) {
      return existingRegistration;
    }

    const registration = {
      callback,
      unregister: () => {
        registrationArray = arrayWithout(registrationArray, registration);
      }
    };
    registrationArray = [registration, ...registrationArray];
    return registration;
  };

  const throwIfRequested = () => {
    if (requested) {
      throw cancelError;
    }
  };

  return {
    token: {
      register,

      get cancellationRequested() {
        return requested;
      },

      throwIfRequested
    },
    cancel
  };
};

const catchAsyncFunctionCancellation = asyncFunction => {
  return asyncFunction().catch(error => {
    if (isCancelError(error)) return;
    throw error;
  });
};

const createCancellationTokenForProcessSIGINT = () => {
  const SIGINTCancelSource = createCancellationSource();
  process.on("SIGINT", () => SIGINTCancelSource.cancel("process interruption"));
  return SIGINTCancelSource.token;
};

const LOG_LEVEL_OFF = "off";
const LOG_LEVEL_DEBUG = "debug";
const LOG_LEVEL_INFO = "info";
const LOG_LEVEL_WARN = "warn";
const LOG_LEVEL_ERROR = "error";

const createLogger = ({
  logLevel = LOG_LEVEL_INFO
} = {}) => {
  if (logLevel === LOG_LEVEL_DEBUG) {
    return {
      debug,
      info,
      warn,
      error
    };
  }

  if (logLevel === LOG_LEVEL_INFO) {
    return {
      debug: debugDisabled,
      info,
      warn,
      error
    };
  }

  if (logLevel === LOG_LEVEL_WARN) {
    return {
      debug: debugDisabled,
      info: infoDisabled,
      warn,
      error
    };
  }

  if (logLevel === LOG_LEVEL_ERROR) {
    return {
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error
    };
  }

  if (logLevel === LOG_LEVEL_OFF) {
    return {
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error: errorDisabled
    };
  }

  throw new Error(createUnexpectedLogLevelMessage({
    logLevel
  }));
};

const createUnexpectedLogLevelMessage = ({
  logLevel
}) => `unexpected logLevel.
--- logLevel ---
${logLevel}
--- allowed log levels ---
${LOG_LEVEL_OFF}
${LOG_LEVEL_ERROR}
${LOG_LEVEL_WARN}
${LOG_LEVEL_INFO}
${LOG_LEVEL_DEBUG}
`;

const debug = console.debug;

const debugDisabled = () => {};

const info = console.info;

const infoDisabled = () => {};

const warn = console.warn;

const warnDisabled = () => {};

const error = console.error;

const errorDisabled = () => {};

const rimraf = nodeRequire("rimraf");

const createFileDirectories = filePath => {
  return new Promise((resolve, reject) => {
    fs.mkdir(path.dirname(filePath), {
      recursive: true
    }, error => {
      if (error) {
        if (error.code === "EEXIST") {
          resolve();
          return;
        }

        reject(error);
        return;
      }

      resolve();
    });
  });
};
const statPromisified = util.promisify(fs.stat);
const readFileStat = async filePath => {
  const statsObject = await statPromisified(filePath);
  return statsObject;
};
const readFilePromisified = util.promisify(fs.readFile);
const readFileContent = async filePath => {
  const buffer = await readFilePromisified(filePath);
  return buffer.toString();
};
const writeFilePromisified = util.promisify(fs.writeFile);
const writeFileContent = async (filePath, content) => {
  await createFileDirectories(filePath);
  return writeFilePromisified(filePath, content);
};
const removeDirectory = path => new Promise((resolve, reject) => rimraf(path, error => {
  if (error) reject(error);else resolve();
}));
const removeFile = path => new Promise((resolve, reject) => {
  fs.unlink(path, error => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
});
const assertDirectoryExists = async fileUrl => {
  const directoryPath = fileUrlToPath(fileUrl);
  const filesystemEntry = await pathToFilesystemEntry(directoryPath);

  if (!filesystemEntry) {
    throw new Error(`directory not found at ${directoryPath}`);
  }

  const {
    type
  } = filesystemEntry;

  if (type !== "folder") {
    throw new Error(`directory expected at ${directoryPath} but found ${type}`);
  }
};
const assertFileExists = async fileUrl => {
  const filePath = fileUrlToPath(fileUrl);
  const filesystemEntry = await pathToFilesystemEntry(filePath);

  if (!filesystemEntry) {
    throw new Error(`file not found at ${filePath}`);
  }

  const {
    type
  } = filesystemEntry;

  if (type !== "file") {
    throw new Error(`file expected at ${filePath} but found ${type}`);
  }
};
const fileExists = fileUrl => {
  return new Promise((resolve, reject) => {
    fs.stat(fileUrlToPath(fileUrl), error => {
      if (error) {
        if (error.code === "ENOENT") resolve(false);else reject(error);
      } else {
        resolve(true);
      }
    });
  });
};

const pathToFilesystemEntry = path => new Promise((resolve, reject) => {
  fs.stat(path, (error, stats) => {
    if (error) {
      if (error.code === "ENOENT") resolve(null);else reject(error);
    } else {
      resolve({
        // eslint-disable-next-line no-nested-ternary
        type: stats.isFile() ? "file" : stats.isDirectory() ? "folder" : "other",
        stats
      });
    }
  });
});

const assertProjectDirectoryPath = ({
  projectDirectoryPath
}) => {
  if (typeof projectDirectoryPath !== "string") {
    throw new TypeError(`projectDirectoryPath must be a string, received ${projectDirectoryPath}`);
  }
};
const assertProjectDirectoryExists = ({
  projectDirectoryUrl
}) => {
  assertDirectoryExists(projectDirectoryUrl);
};
const assertImportMapFileRelativeUrl = ({
  importMapFileRelativeUrl
}) => {
  if (typeof importMapFileRelativeUrl !== "string") {
    throw new TypeError(`importMapFileRelativeUrl must be a string, received ${importMapFileRelativeUrl}`);
  }
};
const assertImportMapFileInsideProject = ({
  importMapFileUrl,
  projectDirectoryUrl
}) => {
  if (!importMapFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`importmap file must be inside project directory
--- import map file url ---
${importMapFileUrl}
--- project directory url ---
${projectDirectoryUrl}`);
  }
};

// https://github.com/systemjs/systemjs/blob/89391f92dfeac33919b0223bbf834a1f4eea5750/src/common.js#L136
const composeTwoImportMaps = (leftImportMap, rightImportMap) => {
  assertImportMap(leftImportMap);
  assertImportMap(rightImportMap);
  return {
    imports: composeTwoImports(leftImportMap.imports, rightImportMap.imports),
    scopes: composeTwoScopes(leftImportMap.scopes, rightImportMap.scopes)
  };
};

const composeTwoImports = (leftImports = {}, rightImports = {}) => {
  return { ...leftImports,
    ...rightImports
  };
};

const composeTwoScopes = (leftScopes = {}, rightScopes = {}) => {
  const scopes = { ...leftScopes
  };
  Object.keys(rightScopes).forEach(scopeKey => {
    if (scopes.hasOwnProperty(scopeKey)) {
      scopes[scopeKey] = { ...scopes[scopeKey],
        ...rightScopes[scopeKey]
      };
    } else {
      scopes[scopeKey] = { ...rightScopes[scopeKey]
      };
    }
  });
  return scopes;
};

const pathToDirectoryUrl$1 = path => {
  const directoryUrl = path.startsWith("file://") ? path : String(url$2.pathToFileURL(path));

  if (directoryUrl.endsWith("/")) {
    return directoryUrl;
  }

  return `${directoryUrl}/`;
};
const fileUrlToPath$1 = fileUrl => {
  return url$2.fileURLToPath(fileUrl);
};
const directoryUrlToPackageFileUrl = directoryUrl => {
  return String(new URL("./package.json", directoryUrl));
};
const resolveFileUrl = (specifier, baseUrl) => {
  return String(new URL(specifier, baseUrl));
};
const fileUrlToDirectoryUrl = fileUrl => {
  const directoryUrl = String(new URL("./", fileUrl));

  if (directoryUrl.endsWith("/")) {
    return directoryUrl;
  }

  return `${directoryUrl}/`;
};
const fileUrlToRelativePath$1 = (fileUrl, baseUrl) => {
  if (fileUrl.startsWith(baseUrl)) {
    return `./${fileUrl.slice(baseUrl.length)}`;
  }

  return fileUrl;
};
const hasScheme$3 = string => {
  return /^[a-zA-Z]{2,}:/.test(string);
};

// certainly needs to be moved to @dmail/cancellation
const firstOperationMatching$1 = ({
  array,
  start,
  predicate
}) => {
  if (typeof array !== "object") throw new TypeError(createArrayErrorMessage({
    array
  }));
  if (typeof start !== "function") throw new TypeError(createStartErrorMessage({
    start
  }));
  if (typeof predicate !== "function") throw new TypeError(createPredicateErrorMessage({
    predicate
  }));
  return new Promise((resolve, reject) => {
    const visit = index => {
      if (index >= array.length) {
        return resolve();
      }

      const input = array[index];
      const returnValue = start(input);
      return Promise.resolve(returnValue).then(output => {
        if (predicate(output)) {
          return resolve(output);
        }

        return visit(index + 1);
      }, reject);
    };

    visit(0);
  });
};

const createArrayErrorMessage = ({
  array
}) => `array must be an object.
array: ${array}`;

const createStartErrorMessage = ({
  start
}) => `start must be a function.
start: ${start}`;

const createPredicateErrorMessage = ({
  predicate
}) => `predicate must be a function.
predicate: ${predicate}`;

const copyFilePromisified = util.promisify(fs.copyFile);

const readFilePromisified$1 = util.promisify(fs.readFile);
const fileRead = async file => {
  const buffer = await readFilePromisified$1(file);
  return buffer.toString();
};

const statPromisified$1 = util.promisify(fs.stat);

const lstatPromisified = util.promisify(fs.lstat);

const writeFilePromisified$1 = util.promisify(fs.writeFile);

const readdirPromisified = util.promisify(fs.readdir);

const readPackageFile = async path => {
  const packageFileString = await fileRead(path);
  const packageJsonObject = JSON.parse(packageFileString);
  return packageJsonObject;
};

const resolveNodeModule = async ({
  logger,
  rootProjectDirectoryUrl,
  packageFileUrl,
  packageJsonObject,
  dependencyName,
  dependencyVersionPattern,
  dependencyType
}) => {
  const packageDirectoryUrl = fileUrlToDirectoryUrl(packageFileUrl);
  const nodeModuleCandidateArray = [...computeNodeModuleCandidateArray(packageDirectoryUrl, rootProjectDirectoryUrl), `node_modules/`];
  const result = await firstOperationMatching$1({
    array: nodeModuleCandidateArray,
    start: async nodeModuleCandidate => {
      const packageFileUrl = `${rootProjectDirectoryUrl}${nodeModuleCandidate}${dependencyName}/package.json`;
      const packageFilePath = url$2.fileURLToPath(packageFileUrl);

      try {
        const packageJsonObject = await readPackageFile(packageFilePath);
        return {
          packageFileUrl,
          packageJsonObject
        };
      } catch (e) {
        if (e.code === "ENOENT") {
          return {};
        }

        if (e.name === "SyntaxError") {
          logger.error(`
error while parsing dependency package.json.
--- parsing error message ---
${e.message}
--- package.json path ---
${packageFilePath}
`);
          return {};
        }

        throw e;
      }
    },
    predicate: ({
      packageJsonObject
    }) => Boolean(packageJsonObject)
  });

  if (!result) {
    logger.warn(`
cannot find a ${dependencyType}.
--- ${dependencyType} ---
${dependencyName}@${dependencyVersionPattern}
--- required by ---
${packageJsonObject.name}@${packageJsonObject.version}
--- package.json path ---
${url$2.fileURLToPath(packageFileUrl)}
    `);
  }

  return result;
};

const computeNodeModuleCandidateArray = (packageDirectoryUrl, rootProjectDirectoryUrl) => {
  if (packageDirectoryUrl === rootProjectDirectoryUrl) {
    return [];
  }

  const packageDirectoryRelativePath = fileUrlToRelativePath$1(packageDirectoryUrl, rootProjectDirectoryUrl);
  const candidateArray = [];
  const relativeNodeModuleDirectoryArray = packageDirectoryRelativePath.split("/node_modules/"); // remove the first empty string

  relativeNodeModuleDirectoryArray.shift();
  let i = relativeNodeModuleDirectoryArray.length;

  while (i--) {
    candidateArray.push(`node_modules/${relativeNodeModuleDirectoryArray.slice(0, i + 1).join("/node_modules/")}node_modules/`);
  }

  return candidateArray;
};

const resolvePackageMain = ({
  logger,
  packageFileUrl,
  packageJsonObject
}) => {
  if ("module" in packageJsonObject) {
    return resolveMainFile({
      logger,
      packageFileUrl,
      packageMainFieldName: "module",
      packageMainFieldValue: packageJsonObject.module
    });
  }

  if ("jsnext:main" in packageJsonObject) {
    return resolveMainFile({
      logger,
      packageFileUrl,
      packageMainFieldName: "jsnext:main",
      packageMainFieldValue: packageJsonObject["jsnext:main"]
    });
  }

  if ("main" in packageJsonObject) {
    return resolveMainFile({
      logger,
      packageFileUrl,
      packageMainFieldName: "main",
      packageMainFieldValue: packageJsonObject.main
    });
  }

  return resolveMainFile({
    logger,
    packageFileUrl,
    packageMainFieldName: "default",
    packageMainFieldValue: "index"
  });
};
const extensionCandidateArray = ["js", "json", "node"];

const resolveMainFile = async ({
  logger,
  packageFileUrl,
  packageMainFieldName,
  packageMainFieldValue
}) => {
  // main is explicitely empty meaning
  // it is assumed that we should not find a file
  if (packageMainFieldValue === "") {
    return null;
  }

  const packageFilePath = fileUrlToPath$1(packageFileUrl);
  const packageDirectoryUrl = fileUrlToDirectoryUrl(packageFileUrl);
  const mainFileRelativePath = packageMainFieldValue.endsWith("/") ? `${packageMainFieldValue}index` : packageMainFieldValue;
  const mainFileUrlFirstCandidate = resolveFileUrl(mainFileRelativePath, packageFileUrl);

  if (!mainFileUrlFirstCandidate.startsWith(packageDirectoryUrl)) {
    logger.warn(`
${packageMainFieldName} field in package.json must be inside package.json folder.
--- ${packageMainFieldName} ---
${packageMainFieldValue}
--- package.json path ---
${packageFilePath}
`);
    return null;
  }

  const mainFileUrl = await findMainFileUrlOrNull(mainFileUrlFirstCandidate);

  if (mainFileUrl === null) {
    // we know in advance this remapping does not lead to an actual file.
    // we only warn because we have no guarantee this remapping will actually be used
    // in the codebase.
    // warn only if there is actually a main field
    // otherwise the package.json is missing the main field
    // it certainly means it's not important
    if (packageMainFieldName !== "default") {
      logger.warn(`
cannot find file for package.json ${packageMainFieldName} field
--- ${packageMainFieldName} ---
${packageMainFieldValue}
--- file path ---
${url$2.fileURLToPath(mainFileUrlFirstCandidate)}
--- package.json path ---
${packageFilePath}
--- extensions tried ---
${extensionCandidateArray.join(`,`)}
        `);
    }

    return mainFileUrlFirstCandidate;
  }

  return mainFileUrl;
};

const findMainFileUrlOrNull = async mainFileUrl => {
  const mainFilePath = fileUrlToPath$1(mainFileUrl);
  const stats = await pathToStats(mainFilePath);

  if (stats === null) {
    const extension = path.extname(mainFilePath);

    if (extension === "") {
      const extensionLeadingToAFile = await findExtension(mainFilePath);

      if (extensionLeadingToAFile === null) {
        return null;
      }

      return `${mainFileUrl}.${extensionLeadingToAFile}`;
    }

    return null;
  }

  if (stats.isFile()) {
    return mainFileUrl;
  }

  if (stats.isDirectory()) {
    const indexFileUrl = resolveFileUrl("./index", mainFileUrl.endsWith("/") ? mainFileUrl : `${mainFileUrl}/`);
    const extensionLeadingToAFile = await findExtension(fileUrlToPath$1(indexFileUrl));

    if (extensionLeadingToAFile === null) {
      return null;
    }

    return `${indexFileUrl}.${extensionLeadingToAFile}`;
  }

  return null;
};

const findExtension = async path$1 => {
  const pathDirname = path.dirname(path$1);
  const pathBasename = path.basename(path$1);
  const extensionLeadingToFile = await firstOperationMatching$1({
    array: extensionCandidateArray,
    start: async extensionCandidate => {
      const pathCandidate = `${pathDirname}/${pathBasename}.${extensionCandidate}`;
      const stats = await pathToStats(pathCandidate);
      return stats && stats.isFile() ? extensionCandidate : null;
    },
    predicate: extension => Boolean(extension)
  });
  return extensionLeadingToFile || null;
};

const pathToStats = path => {
  return new Promise((resolve, reject) => {
    fs.stat(path, (error, statObject) => {
      if (error) {
        if (error.code === "ENOENT") resolve(null);else reject(error);
      } else {
        resolve(statObject);
      }
    });
  });
};

const visitPackageImports = ({
  logger,
  packageFileUrl,
  packageJsonObject
}) => {
  const importsForPackageImports = {};
  const packageFilePath = fileUrlToPath$1(packageFileUrl);
  const {
    imports: packageImports
  } = packageJsonObject;

  if (typeof packageImports !== "object" || packageImports === null) {
    logger.warn(`
imports of package.json must be an object.
--- package.json imports ---
${packageImports}
--- package.json path ---
${packageFilePath}
`);
    return importsForPackageImports;
  }

  Object.keys(packageImports).forEach(specifier => {
    if (hasScheme$3(specifier) || specifier.startsWith("//") || specifier.startsWith("../")) {
      logger.warn(`
found unexpected specifier in imports of package.json, it must be relative to package.json.
--- specifier ---
${specifier}
--- package.json path ---
${packageFilePath}
`);
      return;
    }

    const address = packageImports[specifier];

    if (typeof address !== "string") {
      logger.warn(`
found unexpected address in imports of package.json, it must be a string.
--- address ---
${address}
--- specifier ---
${specifier}
--- package.json path ---
${packageFilePath}
`);
      return;
    }

    if (hasScheme$3(address) || address.startsWith("//") || address.startsWith("../")) {
      logger.warn(`
found unexpected address in imports of package.json, it must be relative to package.json.
--- address ---
${address}
--- specifier ---
${specifier}
--- package.json path ---
${packageFilePath}
`);
      return;
    }

    let from;

    if (specifier[0] === "/") {
      from = specifier;
    } else if (specifier.startsWith("./")) {
      from = specifier;
    } else {
      from = specifier;
    }

    const to = address;
    importsForPackageImports[from] = to;
  });
  return importsForPackageImports;
};

const visitPackageExports = ({
  logger,
  packageFileUrl,
  packageName,
  packageJsonObject,
  packageInfo: {
    packageIsRoot,
    packageDirectoryRelativePath
  }
}) => {
  const importsForPackageExports = {};

  if (packageIsRoot) {
    return importsForPackageExports;
  }

  const packageFilePath = fileUrlToPath$1(packageFileUrl);
  const {
    exports: packageExports
  } = packageJsonObject;

  if (typeof packageExports !== "object" || packageExports === null) {
    logger.warn(`
exports of package.json must be an object.
--- package.json exports ---
${packageExports}
--- package.json path ---
${packageFilePath}
`);
    return importsForPackageExports;
  }

  Object.keys(packageExports).forEach(specifier => {
    if (hasScheme$3(specifier) || specifier.startsWith("//") || specifier.startsWith("../")) {
      logger.warn(`
found unexpected specifier in exports of package.json, it must be relative to package.json.
--- specifier ---
${specifier}
--- package.json path ---
${packageFilePath}
`);
      return;
    }

    const address = packageExports[specifier];

    if (typeof address !== "string") {
      logger.warn(`
found unexpected address in exports of package.json, it must be a string.
--- address ---
${address}
--- specifier ---
${specifier}
--- package.json path ---
${packageFilePath}
`);
      return;
    }

    if (hasScheme$3(address) || address.startsWith("//") || address.startsWith("../")) {
      logger.warn(`
found unexpected address in exports of package.json, it must be relative to package.json.
--- address ---
${address}
--- specifier ---
${specifier}
--- package.json path ---
${packageFilePath}
`);
      return;
    }

    let from;

    if (specifier[0] === "/") {
      from = specifier;
    } else if (specifier.startsWith("./")) {
      from = `${packageName}${specifier.slice(1)}`;
    } else {
      from = `${packageName}/${specifier}`;
    }

    let to;

    if (address[0] === "/") {
      to = address;
    } else if (address.startsWith("./")) {
      to = `${packageDirectoryRelativePath}${address.slice(2)}`;
    } else {
      to = `${packageDirectoryRelativePath}${address}`;
    }

    importsForPackageExports[from] = to;
  });
  return importsForPackageExports;
};

/* eslint-disable import/max-dependencies */
const generateImportMapForPackage = async ({
  logger,
  projectDirectoryPath,
  rootProjectDirectoryPath = projectDirectoryPath,
  includeDevDependencies = false
}) => {
  const projectDirectoryUrl = pathToDirectoryUrl$1(projectDirectoryPath);
  const rootProjectDirectoryUrl = pathToDirectoryUrl$1(rootProjectDirectoryPath);
  const projectPackageFileUrl = directoryUrlToPackageFileUrl(projectDirectoryUrl);
  const rootProjectPackageFileUrl = directoryUrlToPackageFileUrl(rootProjectDirectoryUrl);
  const imports = {};
  const scopes = {};
  const seen = {};

  const markPackageAsSeen = (packageFileUrl, importerPackageFileUrl) => {
    if (packageFileUrl in seen) {
      seen[packageFileUrl].push(importerPackageFileUrl);
    } else {
      seen[packageFileUrl] = [importerPackageFileUrl];
    }
  };

  const packageIsSeen = (packageFileUrl, importerPackageFileUrl) => {
    return packageFileUrl in seen && seen[packageFileUrl].includes(importerPackageFileUrl);
  };

  const visit = async ({
    packageFileUrl,
    packageName,
    packageJsonObject,
    importerPackageFileUrl,
    includeDevDependencies
  }) => {
    await visitPackage({
      packageFileUrl,
      packageName,
      packageJsonObject,
      importerPackageFileUrl
    });
    await visitDependencies({
      packageFileUrl,
      packageJsonObject,
      includeDevDependencies
    });
  };

  const visitPackage = async ({
    packageFileUrl,
    packageName,
    packageJsonObject,
    importerPackageFileUrl
  }) => {
    const packageInfo = computePackageInfo({
      packageFileUrl,
      packageName,
      importerPackageFileUrl
    });
    await visitPackageMain({
      packageFileUrl,
      packageName,
      packageJsonObject,
      packageInfo
    });

    if ("imports" in packageJsonObject) {
      const importsForPackageImports = visitPackageImports({
        packageFileUrl,
        packageName,
        packageJsonObject,
        packageInfo
      });
      const {
        packageIsRoot,
        packageDirectoryRelativePath
      } = packageInfo;
      Object.keys(importsForPackageImports).forEach(from => {
        const to = importsForPackageImports[from];

        if (packageIsRoot) {
          addImportMapping({
            from,
            to
          });
        } else {
          const toScoped = to[0] === "/" ? to : `${packageDirectoryRelativePath}${to.startsWith("./") ? to.slice(2) : to}`;
          addScopedImportMapping({
            scope: packageDirectoryRelativePath,
            from,
            to: toScoped
          }); // when a package says './' maps to './'
          // we must add something to say if we are already inside the package
          // no need to ensure leading slash are scoped to the package

          if (from === "./" && to === "./") {
            addScopedImportMapping({
              scope: packageDirectoryRelativePath,
              from: packageDirectoryRelativePath,
              to: packageDirectoryRelativePath
            });
          } else if (from === "/" && to === "/") {
            addScopedImportMapping({
              scope: packageDirectoryRelativePath,
              from: packageDirectoryRelativePath,
              to: packageDirectoryRelativePath
            });
          }
        }
      });
    }

    if ("exports" in packageJsonObject) {
      const importsForPackageExports = visitPackageExports({
        packageFileUrl,
        packageName,
        packageJsonObject,
        packageInfo
      });
      const {
        importerIsRoot,
        importerRelativePath,
        packageDirectoryUrl,
        packageDirectoryUrlExpected
      } = packageInfo;
      Object.keys(importsForPackageExports).forEach(from => {
        const to = importsForPackageExports[from];

        if (importerIsRoot) {
          addImportMapping({
            from,
            to
          });
        } else {
          addScopedImportMapping({
            scope: importerRelativePath,
            from,
            to
          });
        }

        if (packageDirectoryUrl !== packageDirectoryUrlExpected) {
          addScopedImportMapping({
            scope: importerRelativePath,
            from,
            to
          });
        }
      });
    }
  };

  const visitPackageMain = async ({
    packageFileUrl,
    packageName,
    packageJsonObject,
    packageInfo: {
      importerIsRoot,
      importerRelativePath,
      packageIsRoot,
      packageIsProject,
      packageDirectoryUrl,
      packageDirectoryUrlExpected
    }
  }) => {
    if (packageIsRoot) return;
    if (packageIsProject) return;
    const mainFileUrl = await resolvePackageMain({
      packageFileUrl,
      packageJsonObject,
      logger
    }); // it's possible to have no main
    // like { main: "" } in package.json
    // or a main that does not lead to an actual file

    if (mainFileUrl === null) return;
    const mainFileRelativePath = fileUrlToRelativePath$1(mainFileUrl, rootProjectDirectoryUrl);
    const from = packageName;
    const to = mainFileRelativePath;

    if (importerIsRoot) {
      addImportMapping({
        from,
        to
      });
    } else {
      addScopedImportMapping({
        scope: importerRelativePath,
        from,
        to
      });
    }

    if (packageDirectoryUrl !== packageDirectoryUrlExpected) {
      addScopedImportMapping({
        scope: importerRelativePath,
        from,
        to
      });
    }
  };

  const visitDependencies = async ({
    packageFileUrl,
    packageJsonObject,
    includeDevDependencies
  }) => {
    const dependencyMap = {};
    const {
      dependencies = {}
    } = packageJsonObject;
    Object.keys(dependencies).forEach(dependencyName => {
      dependencyMap[dependencyName] = {
        type: "dependency",
        versionPattern: dependencies[dependencyName]
      };
    });
    const {
      peerDependencies = {}
    } = packageJsonObject;
    Object.keys(peerDependencies).forEach(dependencyName => {
      dependencyMap[dependencyName] = {
        type: "peerDependency",
        versionPattern: peerDependencies[dependencyName]
      };
    });
    const isProjectPackage = packageFileUrl === projectPackageFileUrl;

    if (includeDevDependencies && isProjectPackage) {
      const {
        devDependencies = {}
      } = packageJsonObject;
      Object.keys(devDependencies).forEach(dependencyName => {
        if (!dependencyMap.hasOwnProperty(dependencyName)) {
          dependencyMap[dependencyName] = {
            type: "devDependency",
            versionPattern: devDependencies[dependencyName]
          };
        }
      });
    }

    await Promise.all(Object.keys(dependencyMap).map(async dependencyName => {
      const dependency = dependencyMap[dependencyName];
      await visitDependency({
        packageFileUrl,
        packageJsonObject,
        dependencyName,
        dependencyType: dependency.type,
        dependencyVersionPattern: dependency.versionPattern
      });
    }));
  };

  const visitDependency = async ({
    packageFileUrl,
    packageJsonObject,
    dependencyName,
    dependencyType,
    dependencyVersionPattern
  }) => {
    const dependencyData = await findDependency({
      packageFileUrl,
      packageJsonObject,
      dependencyName,
      dependencyType,
      dependencyVersionPattern
    });

    if (!dependencyData) {
      return;
    }

    const {
      packageFileUrl: dependencyPackageFileUrl,
      packageJsonObject: dependencyPackageJsonObject
    } = dependencyData;

    if (packageIsSeen(dependencyPackageFileUrl, packageFileUrl)) {
      return;
    }

    markPackageAsSeen(dependencyPackageFileUrl, packageFileUrl);
    await visit({
      packageFileUrl: dependencyPackageFileUrl,
      packageName: dependencyName,
      packageJsonObject: dependencyPackageJsonObject,
      importerPackageFileUrl: packageFileUrl
    });
  };

  const computePackageInfo = ({
    packageFileUrl,
    packageName,
    importerPackageFileUrl
  }) => {
    const importerIsRoot = importerPackageFileUrl === rootProjectPackageFileUrl;
    const importerIsProject = importerPackageFileUrl === projectPackageFileUrl;
    const importerPackageDirectoryUrl = fileUrlToDirectoryUrl(importerPackageFileUrl);
    const importerRelativePath = importerIsRoot ? `./${path.basename(rootProjectDirectoryUrl)}/` : fileUrlToRelativePath$1(importerPackageDirectoryUrl, rootProjectDirectoryUrl);
    const packageIsRoot = packageFileUrl === rootProjectPackageFileUrl;
    const packageIsProject = packageFileUrl === projectPackageFileUrl;
    const packageDirectoryUrl = fileUrlToDirectoryUrl(packageFileUrl);
    let packageDirectoryUrlExpected;

    if (packageIsProject && !packageIsRoot) {
      packageDirectoryUrlExpected = importerPackageDirectoryUrl;
    } else {
      packageDirectoryUrlExpected = `${importerPackageDirectoryUrl}node_modules/${packageName}/`;
    }

    const packageDirectoryRelativePath = fileUrlToRelativePath$1(packageDirectoryUrl, rootProjectDirectoryUrl);
    return {
      importerIsRoot,
      importerIsProject,
      importerRelativePath,
      packageIsRoot,
      packageIsProject,
      packageDirectoryUrl,
      packageDirectoryUrlExpected,
      packageDirectoryRelativePath
    };
  };

  const addImportMapping = ({
    from,
    to
  }) => {
    // we could think it's useless to remap from with to
    // however it can be used to ensure a weaker remapping
    // does not win over this specific file or folder
    if (from === to) {
      /**
       * however remapping '/' to '/' is truly useless
       * moreover it would make wrapImportMap create something like
       * {
       *   imports: {
       *     "/": "/.dist/best/"
       *   }
       * }
       * that would append the wrapped folder twice
       * */
      if (from === "/") return;
    }

    imports[from] = to;
  };

  const addScopedImportMapping = ({
    scope,
    from,
    to
  }) => {
    scopes[scope] = { ...(scopes[scope] || {}),
      [from]: to
    };
  };

  const dependenciesCache = {};

  const findDependency = ({
    packageFileUrl,
    packageJsonObject,
    dependencyName,
    dependencyType,
    dependencyVersionPattern
  }) => {
    if (packageFileUrl in dependenciesCache === false) {
      dependenciesCache[packageFileUrl] = {};
    }

    if (dependencyName in dependenciesCache[packageFileUrl]) {
      return dependenciesCache[packageFileUrl][dependencyName];
    }

    const dependencyPromise = resolveNodeModule({
      rootProjectDirectoryUrl,
      packageFileUrl,
      packageJsonObject,
      dependencyName,
      dependencyType,
      dependencyVersionPattern,
      logger
    });
    dependenciesCache[packageFileUrl][dependencyName] = dependencyPromise;
    return dependencyPromise;
  };

  const projectPackageJsonObject = await readPackageFile(fileUrlToPath$1(projectPackageFileUrl));
  const packageFileUrl = projectPackageFileUrl;
  const importerPackageFileUrl = projectPackageFileUrl;
  markPackageAsSeen(packageFileUrl, importerPackageFileUrl);
  await visit({
    packageFileUrl,
    packageName: projectPackageJsonObject.name,
    packageJsonObject: projectPackageJsonObject,
    importerPackageFileUrl,
    includeDevDependencies
  });
  return sortImportMap({
    imports,
    scopes
  });
};

// https://github.com/tc39/proposal-cancellation/tree/master/stage0
const createCancellationToken$1 = () => {
  const register = callback => {
    if (typeof callback !== "function") {
      throw new Error(`callback must be a function, got ${callback}`);
    }

    return {
      callback,
      unregister: () => {}
    };
  };

  const throwIfRequested = () => undefined;

  return {
    register,
    cancellationRequested: false,
    throwIfRequested
  };
};

const createOperation$1 = ({
  cancellationToken = createCancellationToken$1(),
  start,
  ...rest
}) => {
  ensureExactParameters(rest);
  cancellationToken.throwIfRequested();
  const promise = new Promise(resolve => {
    resolve(start());
  });
  const cancelPromise = new Promise((resolve, reject) => {
    const cancelRegistration = cancellationToken.register(cancelError => {
      cancelRegistration.unregister();
      reject(cancelError);
    });
    promise.then(cancelRegistration.unregister, () => {});
  });
  const operationPromise = Promise.race([promise, cancelPromise]);
  return operationPromise;
};

const ensureExactParameters = extraParameters => {
  const extraParamNames = Object.keys(extraParameters);
  if (extraParamNames.length) throw new Error(`createOperation expect only cancellationToken, start. Got ${extraParamNames}`);
};

const pathToDirectoryUrl$2 = path => {
  const directoryUrl = path.startsWith("file://") ? path : String(url$2.pathToFileURL(path));

  if (directoryUrl.endsWith("/")) {
    return directoryUrl;
  }

  return `${directoryUrl}/`;
};
const pathToFileUrl$1 = path => {
  return path.startsWith("file://") ? path : String(url$2.pathToFileURL(path));
};
const fileUrlToPath$2 = fileUrl => {
  return url$2.fileURLToPath(fileUrl);
};
const fileUrlToRelativePath$2 = (fileUrl, baseUrl) => {
  if (typeof baseUrl !== "string") {
    throw new TypeError(`baseUrl must be a string, got ${baseUrl}`);
  }

  if (fileUrl.startsWith(baseUrl)) {
    return fileUrl.slice(baseUrl.length);
  }

  return fileUrl;
};

const openAsync = util.promisify(fs.open);
const closeAsync = util.promisify(fs.close);
const createWatcher = (path, options) => {
  const watcher = fs.watch(path, options);
  fixPermissionIssueIfWindows(watcher, path);
  return watcher;
};

const fixPermissionIssueIfWindows = (watcher, path) => {
  if (operatingSystemIsWindows()) {
    watcher.on("error", async error => {
      // https://github.com/joyent/node/issues/4337
      if (error.code === "EPERM") {
        try {
          const fd = await openAsync(path, "r");
          await closeAsync(fd);
          console.error(error);
        } catch (error) {}
      }
    });
  }
};

const operatingSystemIsWindows = () => process.platform === "win32";

const trackRessources = () => {
  const callbackArray = [];

  const registerCleanupCallback = callback => {
    if (typeof callback !== "function") throw new TypeError(`callback must be a function
callback: ${callback}`);
    callbackArray.push(callback);
    return () => {
      const index = callbackArray.indexOf(callback);
      if (index > -1) callbackArray.splice(index, 1);
    };
  };

  const cleanup = async reason => {
    const localCallbackArray = callbackArray.slice();
    await Promise.all(localCallbackArray.map(callback => callback(reason)));
  };

  return {
    registerCleanupCallback,
    cleanup
  };
};

const filesystemPathToTypeOrNull = path => {
  try {
    const stats = fs.statSync(path);
    const type = statsToType(stats);
    return type;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    if (error.code === "EPERM") return null;
    throw error;
  }
}; // https://nodejs.org/dist/latest-v13.x/docs/api/fs.html#fs_file_type_constants

const FILESYSTEM_FILE = "file";
const FILESYSTEM_DIRECTORY = "directory";
const FILESYSTEM_SYMBOLIC_LINK = "symbolic-link";
const FILESYSTEM_FIFO = "fifo";
const FILESYSTEM_SOCKET = "socket";
const FILESYSTEM_CHARACTER_DEVICE = "character-device";
const FILESYSTEM_BLOCK_DEVICE = "block-device";

const statsToType = stats => {
  if (stats.isFile()) return FILESYSTEM_FILE;
  if (stats.isDirectory()) return FILESYSTEM_DIRECTORY;
  if (stats.isSymbolicLink()) return FILESYSTEM_SYMBOLIC_LINK;
  if (stats.isFIFO()) return FILESYSTEM_FIFO;
  if (stats.isSocket()) return FILESYSTEM_SOCKET;
  if (stats.isCharacterDevice()) return FILESYSTEM_CHARACTER_DEVICE;
  if (stats.isBlockDevice()) return FILESYSTEM_BLOCK_DEVICE;
  return "unknown type";
};

const operatingSystemIsLinux = () => process.platform === "linux"; // linux does not support recursive option


const fsWatchSupportsRecursive = !operatingSystemIsLinux();
const registerDirectoryLifecycle = (directoryPath, {
  added,
  updated,
  removed,
  watchDescription = {
    "/**/*": true
  },
  notifyExistent = false,
  keepProcessAlive = true
}) => {
  if (typeof directoryPath !== "string") {
    throw new TypeError(`directoryPath must be a string, got ${directoryPath}`);
  }

  if (!undefinedOrFunction(added)) {
    throw new TypeError(`added must be a function or undefined, got ${added}`);
  }

  if (!undefinedOrFunction(added)) {
    throw new TypeError(`updated must be a function or undefined, got ${updated}`);
  }

  if (!undefinedOrFunction(removed)) {
    throw new TypeError(`removed must be a function or undefined, got ${removed}`);
  }

  const directoryUrl = pathToDirectoryUrl$2(directoryPath);
  directoryPath = fileUrlToPath$2(directoryUrl);
  const specifierMetaMap = normalizeSpecifierMetaMap(metaMapToSpecifierMetaMap({
    watch: watchDescription
  }), directoryUrl);

  const entryShouldBeWatched = ({
    relativePath,
    type
  }) => {
    const entryUrl = `${directoryUrl}${relativePath}`;

    if (type === "directory") {
      const canContainEntryToWatch = urlCanContainsMetaMatching({
        url: `${entryUrl}/`,
        specifierMetaMap,
        predicate: ({
          watch
        }) => watch
      });
      return canContainEntryToWatch;
    }

    const entryMeta = urlToMeta({
      url: entryUrl,
      specifierMetaMap
    });
    return entryMeta.watch;
  };

  const tracker = trackRessources();
  const contentMap = {};

  const handleEvent = ({
    dirname,
    basename,
    eventType
  }) => {
    if (basename) {
      if (dirname) {
        handleChange(`${dirname}/${basename}`);
      } else {
        handleChange(`${basename}`);
      }
    } else if ((removed || added) && eventType === "rename") {
      // we might receive `rename` without filename
      // in that case we try to find ourselves which file was removed.
      let relativePathCandidateArray = Object.keys(contentMap);

      if (!fsWatchSupportsRecursive) {
        relativePathCandidateArray = relativePathCandidateArray.filter(relativePath => {
          if (!dirname) {
            // ensure entry is top level
            if (relativePath.includes("/")) return false;
            return true;
          }

          const directoryPath = dirname; // entry not inside this directory

          if (!relativePath.startsWith(directoryPath)) return false;
          const afterDirectory = relativePath.slice(directoryPath.length + 1); // deep inside this directory

          if (afterDirectory.includes("/")) return false;
          return true;
        });
      }

      const removedEntryRelativePath = relativePathCandidateArray.find(relativePathCandidate => {
        const entryUrl = `${directoryUrl}${relativePathCandidate}`;
        const entryPath = fileUrlToPath$2(entryUrl);
        const type = filesystemPathToTypeOrNull(entryPath);

        if (type !== null) {
          return false;
        }

        return true;
      });

      if (removedEntryRelativePath) {
        handleEntryLost({
          relativePath: removedEntryRelativePath,
          type: contentMap[removedEntryRelativePath]
        });
      }
    }
  };

  const handleChange = relativePath => {
    const entryUrl = `${directoryUrl}${relativePath}`;
    const entryPath = fileUrlToPath$2(entryUrl);
    const previousType = contentMap[relativePath];
    const type = filesystemPathToTypeOrNull(entryPath);

    if (!entryShouldBeWatched({
      relativePath,
      type
    })) {
      return;
    } // it's something new


    if (!previousType) {
      if (type === null) return;
      handleEntryFound({
        relativePath,
        type,
        existent: false
      });
      return;
    } // it existed but now it's not here anymore


    if (type === null) {
      handleEntryLost({
        relativePath,
        type: previousType
      });
      return;
    } // it existed but was replaced by something else
    // it's not really an update


    if (previousType !== type) {
      handleEntryLost({
        relativePath,
        type: previousType
      });
      handleEntryFound({
        relativePath,
        type
      });
      return;
    } // a directory cannot really be updated in way that matters for us
    // filesystem is trying to tell us the directory content have changed
    // but we don't care about that
    // we'll already be notified about what has changed


    if (type === "directory") return; // right same type, and the file existed and was not deleted
    // it's likely an update ?
    // but are we sure it's an update ?

    if (updated) {
      updated({
        relativePath,
        type
      });
    }
  };

  const handleEntryFound = ({
    relativePath,
    type,
    existent
  }) => {
    if (!entryShouldBeWatched({
      relativePath,
      type
    })) return;
    contentMap[relativePath] = type;
    const entryUrl = `${directoryUrl}${relativePath}`;

    if (type === "directory") {
      visitDirectory({
        directoryUrl: `${entryUrl}/`,
        entryFound: entry => {
          handleEntryFound({
            relativePath: `${relativePath}/${entry.relativePath}`,
            type: entry.type,
            existent
          });
        }
      });
    }

    if (added) {
      if (existent) {
        if (notifyExistent) {
          added({
            relativePath,
            type,
            existent: true
          });
        }
      } else {
        added({
          relativePath,
          type
        });
      }
    } // we must watch manually every directory we find


    if (!fsWatchSupportsRecursive && type === "directory") {
      const entryPath = fileUrlToPath$2(entryUrl);
      const watcher = createWatcher(entryPath, {
        persistent: keepProcessAlive
      });
      tracker.registerCleanupCallback(() => {
        watcher.close();
      });
      watcher.on("change", (eventType, filename) => {
        handleEvent({
          dirname: relativePath,
          basename: filename ? filename.replace(/\\/g, "/") : "",
          eventType
        });
      });
    }
  };

  const handleEntryLost = ({
    relativePath,
    type
  }) => {
    delete contentMap[relativePath];

    if (removed) {
      removed({
        relativePath,
        type
      });
    }
  };

  visitDirectory({
    directoryUrl,
    entryFound: ({
      relativePath,
      type
    }) => {
      handleEntryFound({
        relativePath,
        type,
        existent: true
      });
    }
  });
  const watcher = createWatcher(directoryPath, {
    recursive: fsWatchSupportsRecursive,
    persistent: keepProcessAlive
  });
  tracker.registerCleanupCallback(() => {
    watcher.close();
  });
  watcher.on("change", (eventType, filePath) => {
    handleEvent({ ...filePathToDirnameAndBasename(filePath),
      eventType
    });
  });
  return tracker.cleanup;
};

const undefinedOrFunction = value => typeof value === "undefined" || typeof value === "function";

const visitDirectory = ({
  directoryUrl,
  entryFound
}) => {
  const directoryPath = fileUrlToPath$2(directoryUrl);
  fs.readdirSync(directoryPath).forEach(entry => {
    const entryUrl = `${directoryUrl}${entry}`;
    const entryPath = fileUrlToPath$2(entryUrl);
    const type = filesystemPathToTypeOrNull(entryPath);
    if (type === null) return;
    const relativePath = fileUrlToRelativePath$2(entryUrl, directoryUrl);
    entryFound({
      relativePath,
      type
    });
  });
};

const filePathToDirnameAndBasename = path => {
  if (!path) {
    return {
      dirname: "",
      basename: ""
    };
  }

  const normalizedPath = path.replace(/\\/g, "/");
  const slashLastIndex = normalizedPath.lastIndexOf("/");

  if (slashLastIndex === -1) {
    return {
      dirname: "",
      basename: normalizedPath
    };
  }

  const dirname = normalizedPath.slice(0, slashLastIndex);
  const basename = normalizedPath.slice(slashLastIndex + 1);
  return {
    dirname,
    basename
  };
};

const watchFileCreation = (path$1, callback, keepProcessAlive) => {
  const parentPath = path.dirname(path$1);
  let parentWatcher = createWatcher(parentPath, {
    persistent: keepProcessAlive
  });
  parentWatcher.on("change", (eventType, filename) => {
    if (filename && filename !== path.basename(path$1)) return;
    const type = filesystemPathToTypeOrNull(path$1); // ignore if something else with that name gets created
    // we are only interested into files

    if (type !== "file") return;
    parentWatcher.close();
    parentWatcher = undefined;
    callback();
  });
  return () => {
    if (parentWatcher) {
      parentWatcher.close();
    }
  };
};

const registerFileLifecycle = (filePath, {
  added,
  updated,
  removed,
  notifyExistent = false,
  keepProcessAlive = true
}) => {
  if (typeof filePath !== "string") {
    throw new TypeError(`filePath must be a string, got ${filePath}`);
  }

  if (!undefinedOrFunction$1(added)) {
    throw new TypeError(`added must be a function or undefined, got ${added}`);
  }

  if (!undefinedOrFunction$1(updated)) {
    throw new TypeError(`updated must be a function or undefined, got ${updated}`);
  }

  if (!undefinedOrFunction$1(removed)) {
    throw new TypeError(`removed must be a function or undefined, got ${removed}`);
  }

  const fileUrl = pathToFileUrl$1(filePath);
  filePath = fileUrlToPath$2(fileUrl);
  const tracker = trackRessources();

  const handleFileFound = ({
    existent
  }) => {
    const fileMutationStopWatching = watchFileMutation(filePath, {
      updated,
      removed: () => {
        fileMutationStopTracking();
        watchFileAdded();

        if (removed) {
          removed();
        }
      },
      keepProcessAlive
    });
    const fileMutationStopTracking = tracker.registerCleanupCallback(fileMutationStopWatching);

    if (added) {
      if (existent) {
        if (notifyExistent) {
          added({
            existent: true
          });
        }
      } else {
        added({});
      }
    }
  };

  const watchFileAdded = () => {
    const fileCreationStopWatching = watchFileCreation(filePath, () => {
      fileCreationgStopTracking();
      handleFileFound({
        existent: false
      });
    }, keepProcessAlive);
    const fileCreationgStopTracking = tracker.registerCleanupCallback(fileCreationStopWatching);
  };

  const type = filesystemPathToTypeOrNull(filePath);

  if (type === "file") {
    handleFileFound({
      existent: true
    });
  } else if (type === null) {
    if (added) {
      watchFileAdded();
    } else {
      throw new Error(`${filePath} must lead to a file, found nothing`);
    }
  } else {
    throw new Error(`${filePath} must lead to a file, ${type} found instead`);
  }

  return tracker.cleanup;
};

const undefinedOrFunction$1 = value => typeof value === "undefined" || typeof value === "function";

const watchFileMutation = (path, {
  updated,
  removed,
  keepProcessAlive
}) => {
  let watcher = createWatcher(path, {
    persistent: keepProcessAlive
  });
  watcher.on("change", () => {
    const type = filesystemPathToTypeOrNull(path);

    if (type === null) {
      watcher.close();
      watcher = undefined;

      if (removed) {
        removed();
      }
    } else if (type === "file") {
      if (updated) {
        updated();
      }
    }
  });
  return () => {
    if (watcher) {
      watcher.close();
    }
  };
};

const compositionMappingToComposeStrict = (compositionMapping, createInitial = () => ({})) => {
  const reducer = compositionMappingToStrictReducer(compositionMapping);
  return (...objects) => objects.reduce(reducer, createInitial());
};

const compositionMappingToStrictReducer = compositionMapping => {
  const propertyComposeStrict = (key, previous, current) => {
    const propertyExistInCurrent = key in current;
    if (!propertyExistInCurrent) return previous[key];
    const propertyExistInPrevious = key in previous;
    if (!propertyExistInPrevious) return current[key];
    const composeProperty = compositionMapping[key];
    return composeProperty(previous[key], current[key]);
  };

  return (previous, current) => {
    if (typeof current !== "object" || current === null) return previous;
    const composed = {};
    Object.keys(compositionMapping).forEach(key => {
      composed[key] = propertyComposeStrict(key, previous, current);
    });
    return composed;
  };
};

const compositionMappingToCompose = (compositionMapping, createInitial = () => ({})) => {
  const reducer = compositionMappingToReducer(compositionMapping);
  return (...objects) => objects.reduce(reducer, createInitial());
};

const compositionMappingToReducer = compositionMapping => {
  const composeProperty = (key, previous, current) => {
    const propertyExistInCurrent = key in current;
    if (!propertyExistInCurrent) return previous[key];
    const propertyExistInPrevious = key in previous;
    if (!propertyExistInPrevious) return current[key];
    const propertyHasComposer = key in compositionMapping;
    if (!propertyHasComposer) return current[key];
    const composerForProperty = compositionMapping[key];
    return composerForProperty(previous[key], current[key]);
  };

  return (previous, current) => {
    if (typeof current !== "object" || current === null) return previous;
    const composed = { ...previous
    };
    Object.keys(current).forEach(key => {
      composed[key] = composeProperty(key, previous, current);
    });
    return composed;
  };
};

const composeHeaderValues = (value, nextValue) => {
  const headerValues = value.split(", ");
  nextValue.split(", ").forEach(value => {
    if (!headerValues.includes(value)) {
      headerValues.push(value);
    }
  });
  return headerValues.join(", ");
};

const headerCompositionMapping = {
  accept: composeHeaderValues,
  "accept-charset": composeHeaderValues,
  "accept-language": composeHeaderValues,
  "access-control-allow-headers": composeHeaderValues,
  "access-control-allow-methods": composeHeaderValues,
  "access-control-allow-origin": composeHeaderValues,
  // 'content-type', // https://github.com/ninenines/cowboy/issues/1230
  vary: composeHeaderValues
};
const composeResponseHeaders = compositionMappingToCompose(headerCompositionMapping);

const responseCompositionMapping = {
  status: (prevStatus, status) => status,
  statusText: (prevStatusText, statusText) => statusText,
  headers: composeResponseHeaders,
  body: (prevBody, body) => body,
  bodyEncoding: (prevEncoding, encoding) => encoding
};
const composeResponse = compositionMappingToComposeStrict(responseCompositionMapping);

const convertFileSystemErrorToResponseProperties = error => {
  // https://iojs.org/api/errors.html#errors_eacces_permission_denied
  if (isErrorWithCode(error, "EACCES")) {
    return {
      status: 403,
      statusText: "no permission to read file"
    };
  }

  if (isErrorWithCode(error, "EPERM")) {
    return {
      status: 403,
      statusText: "no permission to read file"
    };
  }

  if (isErrorWithCode(error, "ENOENT")) {
    return {
      status: 404,
      statusText: "file not found"
    };
  } // file access may be temporarily blocked
  // (by an antivirus scanning it because recently modified for instance)


  if (isErrorWithCode(error, "EBUSY")) {
    return {
      status: 503,
      statusText: "file is busy",
      headers: {
        "retry-after": 0.01 // retry in 10ms

      }
    };
  } // emfile means there is too many files currently opened


  if (isErrorWithCode(error, "EMFILE")) {
    return {
      status: 503,
      statusText: "too many file opened",
      headers: {
        "retry-after": 0.1 // retry in 100ms

      }
    };
  }

  if (isErrorWithCode(error, "EISDIR")) {
    return {
      status: 500,
      statusText: "Unexpected directory operation"
    };
  }

  return Promise.reject(error);
};

const isErrorWithCode = (error, code) => {
  return typeof error === "object" && error.code === code;
};

if ("observable" in Symbol === false) {
  Symbol.observable = Symbol.for("observable");
}

const createObservable = ({
  subscribe
}) => {
  const observable = {
    [Symbol.observable]: () => observable,
    subscribe
  };
  return observable;
};
const subscribe = (observable, {
  next = () => {},
  error = value => {
    throw value;
  },
  complete = () => {}
}) => {
  const {
    subscribe
  } = observable[Symbol.observable]();
  const subscription = subscribe({
    next,
    error,
    complete
  });
  return subscription;
};
const isObservable = value => {
  if (value === null) return false;
  if (value === undefined) return false;
  if (typeof value === "object") return Symbol.observable in value;
  if (typeof value === "function") return Symbol.observable in value;
  return false;
};

const createSSERoom = ({
  logLevel,
  keepaliveDuration = 30 * 1000,
  retryDuration = 1 * 1000,
  historyLength = 1 * 1000,
  maxConnectionAllowed = 100 // max 100 users accepted

} = {}) => {
  const logger = createLogger({
    logLevel
  });
  const connections = new Set(); // what about history that keeps growing ?
  // we should add some limit
  // one limit could be that an event older than 24h is be deleted

  const history = createEventHistory(historyLength);
  let previousEventId;
  let state = "closed";
  let interval;

  const connect = lastKnownId => {
    if (connections.size > maxConnectionAllowed) {
      return {
        status: 503
      };
    }

    if (state === "closed") {
      return {
        status: 204
      };
    }

    const joinEvent = {
      id: previousEventId === undefined ? 0 : previousEventId + 1,
      retry: retryDuration,
      type: "join",
      data: new Date().toLocaleTimeString()
    };
    previousEventId = joinEvent.id;
    history.add(joinEvent);
    const events = [joinEvent, // send events which occured between lastKnownId & now
    ...(lastKnownId === undefined ? [] : history.since(lastKnownId))];
    const body = createObservable({
      subscribe: ({
        next
      }) => {
        events.forEach(event => {
          logger.debug(`send ${event.type} event to this new client`);
          next(stringifySourceEvent(event));
        });
        const connection = {
          write: next
        };

        const unsubscribe = () => {
          connections.delete(connection);
          logger.debug(`connection closed by us, number of client connected to event source: ${connections.size}`);
        };

        connection.unsubscribe = unsubscribe;
        connections.add(connection);
        return {
          unsubscribe
        };
      }
    });
    logger.debug(`client joined, number of client connected to event source: ${connections.size}, max allowed: ${maxConnectionAllowed}`);
    return {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive"
      },
      body
    };
  };

  const write = data => {
    connections.forEach(connection => {
      connection.write(data);
    });
  };

  const sendEvent = event => {
    if (event.type !== "comment") {
      logger.debug(`send ${event.type} event, number of client listening event source: ${connections.size}`);
      event.id = previousEventId === undefined ? 0 : previousEventId + 1;
      previousEventId = event.id;
      history.add(event);
    }

    write(stringifySourceEvent(event));
  };

  const keepAlive = () => {
    // maybe that, when an event occurs, we can delay the keep alive event
    logger.debug(`send keep alive event, number of client listening event source: ${connections.size}`);
    sendEvent({
      type: "comment",
      data: new Date().toLocaleTimeString()
    });
  };

  const start = () => {
    state = "started";
    interval = setInterval(keepAlive, keepaliveDuration);
  };

  const stop = () => {
    logger.debug(`stopping, number of client to close: ${connections.size}`);
    connections.forEach(connection => connection.unsubscribe());
    clearInterval(interval);
    history.reset();
    state = "stopped";
  };

  return {
    start,
    stop,
    connect,
    sendEvent
  };
}; // https://github.com/dmail-old/project/commit/da7d2c88fc8273850812972885d030a22f9d7448
// https://github.com/dmail-old/project/commit/98b3ae6748d461ac4bd9c48944a551b1128f4459
// https://github.com/dmail-old/http-eventsource/blob/master/lib/event-source.js
// http://html5doctor.com/server-sent-events/

const stringifySourceEvent = ({
  data,
  type = "message",
  id,
  retry
}) => {
  let string = "";

  if (id !== undefined) {
    string += `id:${id}\n`;
  }

  if (retry) {
    string += `retry:${retry}\n`;
  }

  if (type !== "message") {
    string += `event:${type}\n`;
  }

  string += `data:${data}\n\n`;
  return string;
};

const createEventHistory = ({
  limit
} = {}) => {
  const events = [];
  let removedCount = 0;

  const add = data => {
    events.push(data);

    if (events.length >= limit) {
      events.shift();
      removedCount++;
    }
  };

  const since = index => {
    index = parseInt(index);

    if (isNaN(index)) {
      throw new TypeError("history.since() expect a number");
    }

    index -= removedCount;
    return index < 0 ? [] : events.slice(index);
  };

  const reset = () => {
    events.length = 0;
    removedCount = 0;
  };

  return {
    add,
    since,
    reset
  };
};

const listen = ({
  cancellationToken,
  server,
  port,
  ip
}) => {
  return createStoppableOperation({
    cancellationToken,
    start: () => startListening(server, port, ip),
    stop: () => stopListening(server)
  });
};
const startListening = (server, port, ip) => new Promise((resolve, reject) => {
  server.on("error", reject);
  server.on("listening", () => {
    // in case port is 0 (randomly assign an available port)
    // https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
    resolve(server.address().port);
  });
  server.listen(port, ip);
});
const stopListening = server => new Promise((resolve, reject) => {
  server.on("error", reject);
  server.on("close", resolve);
  server.close();
});

const findFreePort = async (initialPort = 1, {
  cancellationToken = createCancellationToken(),
  ip = "127.0.0.1",
  min = 1,
  max = 65534,
  next = port => port + 1
} = {}) => {
  const testUntil = async (port, ip) => {
    const free = await portIsFree({
      cancellationToken,
      port,
      ip
    });

    if (free) {
      return port;
    }

    const nextPort = next(port);

    if (nextPort > max) {
      throw new Error(`${ip} has no available port between ${min} and ${max}`);
    }

    return testUntil(nextPort, ip);
  };

  return testUntil(initialPort, ip);
};

const portIsFree = async ({
  cancellationToken,
  port,
  ip
}) => {
  const server = net.createServer();
  const listenOperation = listen({
    cancellationToken,
    server,
    port,
    ip
  });
  return listenOperation.then(() => {
    const stopPromise = listenOperation.stop(); // cancellation must wait for server to be closed before considering
    // cancellation as done

    cancellationToken.register(() => stopPromise);
    return stopPromise.then(() => true);
  }, error => {
    if (error && error.code === "EADDRINUSE") {
      return false;
    }

    if (error && error.code === "EACCES") {
      return false;
    }

    return Promise.reject(error);
  });
};

const firstService = (...callbacks) => {
  return firstOperationMatching({
    array: callbacks,
    start: callback => callback(),
    predicate: serviceGeneratedResponsePredicate
  });
};

const serviceGeneratedResponsePredicate = value => {
  if (value === null) {
    return false;
  }

  return typeof value === "object";
};

const jsenvAccessControlAllowedHeaders = ["x-requested-with"];

const jsenvAccessControlAllowedMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];

const jsenvPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQCll1gJkJqB+KRZsyepQ7gs81UO+73aKPaNbjp/dwo9XfqvNdDp
Ki4zfTwzzJyFXkoN+NGihfQHI+VqRGITc+XzmBPcGu9XIvYy52lV3zjG4sldz+r8
iNBzFwFSdUGmaHfkcm0YhvcjdRhyKalDaLMc3pVX4dq9rRzqm+pkbzVfVQIDAQAB
AoGAImSo2HO8Y7ptCGR5nGKAYnW3+QC4khNoAkAezlK/Qbe/VZzr40Hrjq44Ttn0
uI64+uXvRL5lzQXbpJLHfBraa8J6Vstf2Kwadmg+FyrqBcet6gidqZ6S1LBTfXII
eSUcMIqkourv7LWOs8BfWQQiCf0Em0shGK1qf1lgiOQxoJECQQD+dSJOPqKbdZfJ
/JcsInf5dPkfTNZMhBxpxqiYOvU3684W3LHB1g6BXjHmIF/CIrxcAHsxxXwTGWu9
23Ffu+xPAkEApphOt+CzGdYq+Ygjj6Hq+hx3hkUwKUHSEOcNXG0Eb90m2sCEkXgz
xH7fKYXaohFtis7IFJR4UfYD8pkGYVmdGwJAJf/iFqM9709ZUp25CatAFW3Fgkoc
OqMEBzvWk51CX46EYV+l4BeSZPlnJEGzay96x5Z+z0j5pXSHZXvu62gJ+wJACci+
LsxymFzcr0UQmZnv2/qaBne/yVyFQtrfDQOWFB/P7V8LKiP+Hlc5Mg4bdhNB9LoK
RDMoEeA6ASB9oHAL6wJBAJcYLOICBVQrTil6DroEkrIxQY/S+arKc42uFpj98S+w
k3doJf8KKDrclaRnKfMXxGYhXPUWFpa5fFr1hvcprEo=
-----END RSA PRIVATE KEY-----`;
const jsenvCertificate = `-----BEGIN CERTIFICATE-----
MIIDEDCCAnmgAwIBAgIQd9Gto4GPGwXcLk0flq7bsjANBgkqhkiG9w0BAQsFADCB
kTEuMCwGA1UEAxMlaHR0cHM6Ly9naXRodWIuY29tL2pzZW52L2pzZW52LXNlcnZl
cjELMAkGA1UEBhMCRlIxGDAWBgNVBAgTD0FscGVzIE1hcml0aW1lczERMA8GA1UE
BxMIVmFsYm9ubmUxDjAMBgNVBAoTBWpzZW52MRUwEwYDVQQLEwxqc2VudiBzZXJ2
ZXIwHhcNMTkwNzA5MTQ1MzU4WhcNMjgwNzA5MTQ1MzU5WjCBkTEuMCwGA1UEAxMl
aHR0cHM6Ly9naXRodWIuY29tL2pzZW52L2pzZW52LXNlcnZlcjELMAkGA1UEBhMC
RlIxGDAWBgNVBAgTD0FscGVzIE1hcml0aW1lczERMA8GA1UEBxMIVmFsYm9ubmUx
DjAMBgNVBAoTBWpzZW52MRUwEwYDVQQLEwxqc2VudiBzZXJ2ZXIwgZ8wDQYJKoZI
hvcNAQEBBQADgY0AMIGJAoGBAKWXWAmQmoH4pFmzJ6lDuCzzVQ77vdoo9o1uOn93
Cj1d+q810OkqLjN9PDPMnIVeSg340aKF9Acj5WpEYhNz5fOYE9wa71ci9jLnaVXf
OMbiyV3P6vyI0HMXAVJ1QaZod+RybRiG9yN1GHIpqUNosxzelVfh2r2tHOqb6mRv
NV9VAgMBAAGjZzBlMAwGA1UdEwEB/wQCMAAwDgYDVR0PAQH/BAQDAgWgMBMGA1Ud
JQQMMAoGCCsGAQUFBwMBMB8GA1UdIwQYMBaAFOQhJA9S7idbpNIbvKMyeRWbwyad
MA8GA1UdEQQIMAaHBH8AAAEwDQYJKoZIhvcNAQELBQADgYEAUKPupneUl1bdjbbf
QvUqAExIK0Nv2u54X8l0EJvkdPMNQEer7Npzg5RQWExtvamfEZI1EPOeVfPVu5sz
q4DB6OgAEzkytbKtcgPlhY0GDbim8ELCpO1JNDn/jUXH74VJElwXMZqan5VaQ5c+
qsCeVUdw8QsfIZH6XbkvhCswh4k=
-----END CERTIFICATE-----`;

const jsenvContentTypeMap = {
  "application/javascript": {
    extensions: ["js", "mjs", "ts", "jsx"]
  },
  "application/json": {
    extensions: ["json"]
  },
  "application/octet-stream": {},
  "application/pdf": {
    extensions: ["pdf"]
  },
  "application/xml": {
    extensions: ["xml"]
  },
  "application/x-gzip": {
    extensions: ["gz"]
  },
  "application/wasm": {
    extensions: ["wasm"]
  },
  "application/zip": {
    extensions: ["zip"]
  },
  "audio/basic": {
    extensions: ["au", "snd"]
  },
  "audio/mpeg": {
    extensions: ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"]
  },
  "audio/midi": {
    extensions: ["midi", "mid", "kar", "rmi"]
  },
  "audio/mp4": {
    extensions: ["m4a", "mp4a"]
  },
  "audio/ogg": {
    extensions: ["oga", "ogg", "spx"]
  },
  "audio/webm": {
    extensions: ["weba"]
  },
  "audio/x-wav": {
    extensions: ["wav"]
  },
  "font/ttf": {
    extensions: ["ttf"]
  },
  "font/woff": {
    extensions: ["woff"]
  },
  "font/woff2": {
    extensions: ["woff2"]
  },
  "image/png": {
    extensions: ["png"]
  },
  "image/gif": {
    extensions: ["gif"]
  },
  "image/jpeg": {
    extensions: ["jpg"]
  },
  "image/svg+xml": {
    extensions: ["svg", "svgz"]
  },
  "text/plain": {
    extensions: ["txt"]
  },
  "text/html": {
    extensions: ["html"]
  },
  "text/css": {
    extensions: ["css"]
  },
  "text/cache-manifest": {
    extensions: ["appcache"]
  },
  "video/mp4": {
    extensions: ["mp4", "mp4v", "mpg4"]
  },
  "video/mpeg": {
    extensions: ["mpeg", "mpg", "mpe", "m1v", "m2v"]
  },
  "video/ogg": {
    extensions: ["ogv"]
  },
  "video/webm": {
    extensions: ["webm"]
  }
};

// https://github.com/jshttp/mime-db/blob/master/src/apache-types.json
const urlToContentType = (url, contentTypeMap = jsenvContentTypeMap, contentTypeDefault = "application/octet-stream") => {
  if (typeof contentTypeMap !== "object") {
    throw new TypeError(`contentTypeMap must be an object, got ${contentTypeMap}`);
  }

  const pathname = new URL(url).pathname;
  const extensionWithDot = path.extname(pathname);

  if (!extensionWithDot || extensionWithDot === ".") {
    return contentTypeDefault;
  }

  const extension = extensionWithDot.slice(1);
  const availableContentTypes = Object.keys(contentTypeMap);
  const contentTypeForExtension = availableContentTypes.find(contentTypeName => {
    const contentType = contentTypeMap[contentTypeName];
    return contentType.extensions && contentType.extensions.indexOf(extension) > -1;
  });
  return contentTypeForExtension || contentTypeDefault;
};

const EMPTY_ID = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
const bufferToEtag = buffer => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(`buffer expected, got ${buffer}`);
  }

  if (buffer.length === 0) {
    return EMPTY_ID;
  }

  const hash = crypto.createHash("sha1");
  hash.update(buffer, "utf8");
  const hashBase64String = hash.digest("base64");
  const hashBase64StringSubset = hashBase64String.slice(0, 27);
  const length = buffer.length;
  return `"${length.toString(16)}-${hashBase64StringSubset}"`;
};

const serveFile = async (path, {
  method = "GET",
  headers = {},
  canReadDirectory = false,
  cacheStrategy = "etag",
  contentTypeMap = jsenvContentTypeMap
} = {}) => {
  if (method !== "GET" && method !== "HEAD") {
    return {
      status: 501
    };
  }

  const fileUrl = path.startsWith("file:///") ? path : url$2.pathToFileURL(path);
  const filePath = url$2.fileURLToPath(fileUrl);

  try {
    const cacheWithMtime = cacheStrategy === "mtime";
    const cacheWithETag = cacheStrategy === "etag";
    const cachedDisabled = cacheStrategy === "none";
    const stat = await readFileStat$1(filePath);

    if (stat.isDirectory()) {
      if (canReadDirectory === false) {
        return {
          status: 403,
          statusText: "not allowed to read directory",
          headers: { ...(cachedDisabled ? {
              "cache-control": "no-store"
            } : {})
          }
        };
      }

      const files = await readDirectory(filePath);
      const filesAsJSON = JSON.stringify(files);
      return {
        status: 200,
        headers: { ...(cachedDisabled ? {
            "cache-control": "no-store"
          } : {}),
          "content-type": "application/json",
          "content-length": filesAsJSON.length
        },
        body: filesAsJSON
      };
    }

    if (cacheWithMtime) {
      if ("if-modified-since" in headers) {
        let cachedModificationDate;

        try {
          cachedModificationDate = new Date(headers["if-modified-since"]);
        } catch (e) {
          return {
            status: 400,
            statusText: "if-modified-since header is not a valid date"
          };
        }

        const actualModificationDate = dateToSecondsPrecision(stat.mtime);

        if (Number(cachedModificationDate) >= Number(actualModificationDate)) {
          return {
            status: 304
          };
        }
      }

      return {
        status: 200,
        headers: { ...(cachedDisabled ? {
            "cache-control": "no-store"
          } : {}),
          "last-modified": dateToUTCString(stat.mtime),
          "content-length": stat.size,
          "content-type": urlToContentType(fileUrl, contentTypeMap)
        },
        body: fs.createReadStream(filePath)
      };
    }

    if (cacheWithETag) {
      const buffer = await readFileAsBuffer(filePath);
      const eTag = bufferToEtag(buffer);

      if ("if-none-match" in headers && headers["if-none-match"] === eTag) {
        return {
          status: 304,
          headers: { ...(cachedDisabled ? {
              "cache-control": "no-store"
            } : {})
          }
        };
      }

      return {
        status: 200,
        headers: { ...(cachedDisabled ? {
            "cache-control": "no-store"
          } : {}),
          "content-length": stat.size,
          "content-type": urlToContentType(fileUrl, contentTypeMap),
          etag: eTag
        },
        body: buffer
      };
    }

    return {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-length": stat.size,
        "content-type": urlToContentType(fileUrl, contentTypeMap)
      },
      body: fs.createReadStream(filePath)
    };
  } catch (e) {
    return convertFileSystemErrorToResponseProperties(e);
  }
}; // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString

const dateToUTCString = date => date.toUTCString();

const dateToSecondsPrecision = date => {
  const dateWithSecondsPrecision = new Date(date);
  dateWithSecondsPrecision.setMilliseconds(0);
  return dateWithSecondsPrecision;
};

const readFileAsBuffer = path => new Promise((resolve, reject) => {
  fs.readFile(path, (error, buffer) => {
    if (error) reject(error);else resolve(buffer);
  });
});

const readFileStat$1 = path => new Promise((resolve, reject) => {
  fs.stat(path, (error, stats) => {
    if (error) reject(error);else resolve(stats);
  });
});

const readDirectory = path => new Promise((resolve, reject) => {
  fs.readdir(path, (error, value) => {
    if (error) reject(error);else resolve(value);
  });
});

// eslint-disable-next-line import/no-unresolved
const nodeRequire$1 = require;
const filenameContainsBackSlashes$1 = __filename.indexOf("\\") > -1;
const url$1 = filenameContainsBackSlashes$1 ? `file://${__filename.replace(/\\/g, "/")}` : `file://${__filename}`;

let beforeExitCallbackArray = [];
let uninstall;

const addCallback = callback => {
  if (beforeExitCallbackArray.length === 0) uninstall = install();
  beforeExitCallbackArray = [...beforeExitCallbackArray, callback];
  return () => {
    if (beforeExitCallbackArray.length === 0) return;
    beforeExitCallbackArray = beforeExitCallbackArray.filter(beforeExitCallback => beforeExitCallback !== callback);
    if (beforeExitCallbackArray.length === 0) uninstall();
  };
};

const install = () => {
  const onBeforeExit = () => {
    return beforeExitCallbackArray.reduce(async (previous, callback) => {
      await previous;
      return callback();
    }, Promise.resolve());
  };

  process.once("beforeExit", onBeforeExit);
  return () => {
    process.removeListener("beforeExit", onBeforeExit);
  };
};

const beforeExitSignal = {
  addCallback
};

const addCallback$1 = callback => {
  const triggerDeath = () => callback(); // SIGTERM http://man7.org/linux/man-pages/man7/signal.7.html


  process.once("SIGTERM", triggerDeath);
  return () => {
    process.removeListener("SIGTERM", triggerDeath);
  };
};

const deathSignal = {
  addCallback: addCallback$1
};

const addCallback$2 = (callback, {
  collectExceptions = false
} = {}) => {
  if (!collectExceptions) {
    const exitCallback = () => {
      callback();
    };

    process.on("exit", exitCallback);
    return () => {
      process.removeListener("exit", exitCallback);
    };
  }

  const {
    getExceptions,
    stop
  } = trackExceptions();

  const exitCallback = () => {
    process.removeListener("exit", exitCallback);
    stop();
    callback({
      exceptionArray: getExceptions().map(({
        exception,
        origin
      }) => {
        return {
          exception,
          origin
        };
      })
    });
  };

  process.on("exit", exitCallback);
  return () => {
    process.removeListener("exit", exitCallback);
  };
};

const trackExceptions = () => {
  let exceptionArray = [];

  const unhandledRejectionCallback = (unhandledRejection, promise) => {
    exceptionArray = [...exceptionArray, {
      origin: "unhandledRejection",
      exception: unhandledRejection,
      promise
    }];
  };

  const rejectionHandledCallback = promise => {
    exceptionArray = exceptionArray.filter(exceptionArray => exceptionArray.promise !== promise);
  };

  const uncaughtExceptionCallback = (uncaughtException, origin) => {
    // since node 12.4 https://nodejs.org/docs/latest-v12.x/api/process.html#process_event_uncaughtexception
    if (origin === "unhandledRejection") return;
    exceptionArray = [...exceptionArray, {
      origin: "uncaughtException",
      exception: uncaughtException
    }];
  };

  process.on("unhandledRejection", unhandledRejectionCallback);
  process.on("rejectionHandled", rejectionHandledCallback);
  process.on("uncaughtException", uncaughtExceptionCallback);
  return {
    getExceptions: () => exceptionArray,
    stop: () => {
      process.removeListener("unhandledRejection", unhandledRejectionCallback);
      process.removeListener("rejectionHandled", rejectionHandledCallback);
      process.removeListener("uncaughtException", uncaughtExceptionCallback);
    }
  };
};

const exitSignal = {
  addCallback: addCallback$2
};

const addCallback$3 = callback => {
  const triggerHangUpOrDeath = () => callback(); // SIGHUP http://man7.org/linux/man-pages/man7/signal.7.html


  process.once("SIGUP", triggerHangUpOrDeath);
  return () => {
    process.removeListener("SIGUP", triggerHangUpOrDeath);
  };
};

const hangupOrDeathSignal = {
  addCallback: addCallback$3
};

const addCallback$4 = callback => {
  // SIGINT is CTRL+C from keyboard
  // http://man7.org/linux/man-pages/man7/signal.7.html
  // may also be sent by vscode https://github.com/Microsoft/vscode-node-debug/issues/1#issuecomment-405185642
  process.once("SIGINT", callback);
  return () => {
    process.removeListener("SIGINT", callback);
  };
};

const interruptSignal = {
  addCallback: addCallback$4
};

// usefull to ensure a given server is closed when process stops for instance

const addCallback$5 = callback => {
  return eventRace({
    beforeExit: {
      register: beforeExitSignal.addCallback,
      callback: () => callback("beforeExit")
    },
    hangupOrDeath: {
      register: hangupOrDeathSignal.addCallback,
      callback: () => callback("hangupOrDeath")
    },
    death: {
      register: deathSignal.addCallback,
      callback: () => callback("death")
    },
    exit: {
      register: exitSignal.addCallback,
      callback: () => callback("exit")
    }
  });
};

const eventRace = eventMap => {
  const unregisterMap = {};

  const unregisterAll = reason => {
    return Object.keys(unregisterMap).map(name => unregisterMap[name](reason));
  };

  Object.keys(eventMap).forEach(name => {
    const {
      register,
      callback
    } = eventMap[name];
    unregisterMap[name] = register((...args) => {
      unregisterAll();
      callback(...args);
    });
  });
  return unregisterAll;
};

const teardownSignal = {
  addCallback: addCallback$5
};

const firstOperationMatching$2 = ({
  array,
  start,
  predicate
}) => {
  if (typeof array !== "object") throw new TypeError(createArrayErrorMessage$1({
    array
  }));
  if (typeof start !== "function") throw new TypeError(createStartErrorMessage$1({
    start
  }));
  if (typeof predicate !== "function") throw new TypeError(createPredicateErrorMessage$1({
    predicate
  }));
  return new Promise((resolve, reject) => {
    const visit = index => {
      if (index >= array.length) {
        return resolve();
      }

      const input = array[index];
      const returnValue = start(input);
      return Promise.resolve(returnValue).then(output => {
        if (predicate(output)) {
          return resolve(output);
        }

        return visit(index + 1);
      }, reject);
    };

    visit(0);
  });
};

const createArrayErrorMessage$1 = ({
  array
}) => `array must be an object.
array: ${array}`;

const createStartErrorMessage$1 = ({
  start
}) => `start must be a function.
start: ${start}`;

const createPredicateErrorMessage$1 = ({
  predicate
}) => `predicate must be a function.
predicate: ${predicate}`;

/*
why unadvised ?
- First because you should not do anything when a process uncaughtException
or unhandled rejection happens.
You cannot assume assume or trust the state of your process so you're
likely going to throw an other error trying to handle the first one.
- Second because the error stack trace will be modified making it harder
to reach back what cause the error

Instead you should monitor your process with an other one
and when the monitored process die, here you can do what you want
like analysing logs to find what cause process to die, ping a log server, ...
*/
let recoverCallbackArray = [];
let uninstall$1;

const addCallback$6 = callback => {
  if (recoverCallbackArray.length === 0) uninstall$1 = install$1();
  recoverCallbackArray = [...recoverCallbackArray, callback];
  return () => {
    if (recoverCallbackArray.length === 0) return;
    recoverCallbackArray = recoverCallbackArray.filter(recoverCallback => recoverCallback !== callback);
    if (recoverCallbackArray.length === 0) uninstall$1();
  };
};

const install$1 = () => {
  const onUncaughtException = error => triggerUncaughtException(error);

  const onUnhandledRejection = (value, promise) => triggerUnhandledRejection(value, promise);

  const onRejectionHandled = promise => recoverExceptionMatching(exception => exception.promise === promise);

  process.on("unhandledRejection", onUnhandledRejection);
  process.on("rejectionHandled", onRejectionHandled);
  process.on("uncaughtException", onUncaughtException);
  return () => {
    process.removeListener("unhandledRejection", onUnhandledRejection);
    process.removeListener("rejectionHandled", onRejectionHandled);
    process.removeListener("uncaughtException", onRejectionHandled);
  };
};

const triggerUncaughtException = error => crash({
  type: "uncaughtException",
  value: error
});

const triggerUnhandledRejection = (value, promise) => crash({
  type: "unhandledRejection",
  value,
  promise
});

let isCrashing = false;
let crashReason;
let resolveRecovering;

const crash = async reason => {
  if (isCrashing) {
    console.log(`cannot recover due to ${crashReason.type} during recover`);
    console.error(crashReason.value);
    resolveRecovering(false);
    return;
  }

  console.log(`process starts crashing due to ${crashReason.type}`);
  console.log(`trying to recover`);
  isCrashing = true;
  crashReason = reason;
  const externalRecoverPromise = new Promise(resolve => {
    resolveRecovering = resolve;
  });
  const callbackRecoverPromise = firstOperationMatching$2({
    array: recoverCallbackArray,
    start: recoverCallback => recoverCallback(reason),
    predicate: recovered => typeof recovered === "boolean"
  });
  const recoverPromise = Promise.race([externalRecoverPromise, callbackRecoverPromise]);

  try {
    const recovered = await recoverPromise;
    if (recovered) return;
  } catch (error) {
    console.error(`cannot recover due to internal recover error`);
    console.error(error);
  }

  crashReason = undefined; // uninstall() prevent catching of the next throw
  // else the following would create an infinite loop
  // process.on('uncaughtException', function() {
  //     setTimeout(function() {
  //         throw 'yo';
  //     });
  // });

  uninstall$1();
  throw reason.value; // this mess up the stack trace :'(
};

const recoverExceptionMatching = predicate => {
  if (isCrashing && predicate(crashReason)) {
    resolveRecovering(true);
  }
};

const unadvisedCrashSignal = {
  addCallback: addCallback$6
};

const memoizeOnce$1 = compute => {
  let locked = false;
  let lockValue;

  const memoized = (...args) => {
    if (locked) return lockValue; // if compute is recursive wait for it to be fully done before storing the lockValue
    // so set locked later

    lockValue = compute(...args);
    locked = true;
    return lockValue;
  };

  memoized.deleteCache = () => {
    const value = lockValue;
    locked = false;
    lockValue = undefined;
    return value;
  };

  return memoized;
};

const urlToOrigin = url => {
  return new URL(url).origin;
};

const trackConnections = nodeServer => {
  const connections = new Set();

  const connectionListener = connection => {
    connection.on("close", () => {
      connections.delete(connection);
    });
    connections.add(connection);
  };

  nodeServer.on("connection", connectionListener);

  const stop = reason => {
    nodeServer.removeListener("connection", connectionListener); // should we do this async ?

    connections.forEach(connection => {
      connection.destroy(reason);
    });
  };

  return {
    stop
  };
};

const trackClients = nodeServer => {
  const clients = new Set();

  const clientListener = (nodeRequest, nodeResponse) => {
    const client = {
      nodeRequest,
      nodeResponse
    };
    clients.add(client);
    nodeResponse.on("finish", () => {
      clients.delete(client);
    });
  };

  nodeServer.on("request", clientListener);

  const stop = ({
    status,
    reason
  }) => {
    nodeServer.removeListener("request", clientListener);
    return Promise.all(Array.from(clients).map(({
      nodeResponse
    }) => {
      if (nodeResponse.headersSent === false) {
        nodeResponse.writeHead(status, reason);
      }

      return new Promise(resolve => {
        if (nodeResponse.finished === false) {
          nodeResponse.on("finish", resolve);
          nodeResponse.on("error", resolve);
          nodeResponse.destroy(reason);
        } else {
          resolve();
        }
      });
    }));
  };

  return {
    stop
  };
};

const trackRequestHandlers = nodeServer => {
  const requestHandlers = [];

  const add = handler => {
    requestHandlers.push(handler);
    nodeServer.on("request", handler);
    return () => {
      nodeServer.removeListener("request", handler);
    };
  };

  const stop = () => {
    requestHandlers.forEach(requestHandler => {
      nodeServer.removeListener("request", requestHandler);
    });
    requestHandlers.length = 0;
  };

  return {
    add,
    stop
  };
};

const nodeStreamToObservable = nodeStream => {
  return createObservable({
    subscribe: ({
      next,
      error,
      complete
    }) => {
      // should we do nodeStream.resume() in case the stream was paused
      nodeStream.on("data", next);
      nodeStream.once("error", error);
      nodeStream.once("end", complete);

      const unsubscribe = () => {
        nodeStream.removeListener("data", next);
        nodeStream.removeListener("error", error);
        nodeStream.removeListener("end", complete);

        if (nodeStreamIsNodeRequest(nodeStream)) {
          nodeStream.abort();
        } else {
          nodeStream.destroy();
        }
      };

      if (nodeStreamIsNodeRequest(nodeStream)) {
        nodeStream.once("abort", unsubscribe);
      }

      return {
        unsubscribe
      };
    }
  });
};

const nodeStreamIsNodeRequest = nodeStream => "abort" in nodeStream && "flushHeaders" in nodeStream;

const normalizeHeaderName = headerName => {
  headerName = String(headerName);

  if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(headerName)) {
    throw new TypeError("Invalid character in header field name");
  }

  return headerName.toLowerCase();
};

const normalizeHeaderValue = headerValue => {
  return String(headerValue);
};

/*
https://developer.mozilla.org/en-US/docs/Web/API/Headers
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/
const headersFromObject = headersObject => {
  const headers = {};
  Object.keys(headersObject).forEach(headerName => {
    headers[normalizeHeaderName(headerName)] = normalizeHeaderValue(headersObject[headerName]);
  });
  return headers;
};

const nodeRequestToRequest = (nodeRequest, origin) => {
  const ressource = nodeRequest.url;
  const {
    method
  } = nodeRequest;
  const headers = headersFromObject(nodeRequest.headers);
  const body = method === "POST" || method === "PUT" || method === "PATCH" ? nodeStreamToObservable(nodeRequest) : undefined;
  return Object.freeze({
    origin,
    ressource,
    method,
    headers,
    body
  });
};

const valueToObservable = value => {
  return createObservable({
    subscribe: ({
      next,
      complete
    }) => {
      next(value);
      complete();
      return {
        unsubscribe: () => {}
      };
    }
  });
};

const populateNodeResponse = (nodeResponse, {
  status,
  statusText,
  headers,
  body,
  bodyEncoding
}, {
  ignoreBody
}) => {
  const nodeHeaders = headersToNodeHeaders(headers); // nodejs strange signature for writeHead force this
  // https://nodejs.org/api/http.html#http_response_writehead_statuscode_statusmessage_headers

  if (statusText === undefined) {
    nodeResponse.writeHead(status, nodeHeaders);
  } else {
    nodeResponse.writeHead(status, statusText, nodeHeaders);
  }

  if (ignoreBody) {
    nodeResponse.end();
    return;
  }

  if (bodyEncoding) {
    nodeResponse.setEncoding(bodyEncoding);
  }

  const observable = bodyToObservable(body);
  const subscription = subscribe(observable, {
    next: data => {
      nodeResponse.write(data);
    },
    error: value => {
      nodeResponse.emit("error", value);
    },
    complete: () => {
      nodeResponse.end();
    }
  });
  nodeResponse.once("close", () => {
    // close body in case nodeResponse is prematurely closed
    // while body is writing
    // it may happen in case of server sent event
    // where body is kept open to write to client
    // and the browser is reloaded or closed for instance
    subscription.unsubscribe();
  });
};
const mapping = {// "content-type": "Content-Type",
  // "last-modified": "Last-Modified",
};

const headersToNodeHeaders = headers => {
  const nodeHeaders = {};
  Object.keys(headers).forEach(name => {
    const nodeHeaderName = name in mapping ? mapping[name] : name;
    nodeHeaders[nodeHeaderName] = headers[name];
  });
  return nodeHeaders;
};

const bodyToObservable = body => {
  if (isObservable(body)) return body;
  if (isNodeStream(body)) return nodeStreamToObservable(body);
  return valueToObservable(body);
};

const isNodeStream = value => {
  if (value === undefined) return false;
  if (value instanceof stream.Stream) return true;
  if (value instanceof stream.Writable) return true;
  if (value instanceof stream.Readable) return true;
  return false;
};

// https://github.com/Marak/colors.js/blob/b63ef88e521b42920a9e908848de340b31e68c9d/lib/styles.js#L29
const close = "\x1b[0m";
const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m"; // const blue = "\x1b[34m"

const magenta = "\x1b[35m";
const cyan = "\x1b[36m"; // const white = "\x1b[37m"

const colorizeResponseStatus = status => {
  const statusType = statusToType(status);
  if (statusType === "information") return `${cyan}${status}${close}`;
  if (statusType === "success") return `${green}${status}${close}`;
  if (statusType === "redirection") return `${magenta}${status}${close}`;
  if (statusType === "client-error") return `${yellow}${status}${close}`;
  if (statusType === "server-error") return `${red}${status}${close}`;
  return status;
}; // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status

const statusToType = status => {
  if (statusIsInformation(status)) return "information";
  if (statusIsSuccess(status)) return "success";
  if (statusIsRedirection(status)) return "redirection";
  if (statusIsClientError(status)) return "client-error";
  if (statusIsServerError(status)) return "server-error";
  return "unknown";
};

const statusIsInformation = status => status >= 100 && status < 200;

const statusIsSuccess = status => status >= 200 && status < 300;

const statusIsRedirection = status => status >= 300 && status < 400;

const statusIsClientError = status => status >= 400 && status < 500;

const statusIsServerError = status => status >= 500 && status < 600;

const originAsString = ({
  protocol,
  ip,
  port
}) => {
  const url = new url$2.URL("https://127.0.0.1:80");
  url.protocol = protocol;
  url.hostname = ip;
  url.port = port;
  return url.origin;
};

const createReason = reasonString => {
  return {
    toString: () => reasonString
  };
};

const STOP_REASON_INTERNAL_ERROR = createReason("internal error");
const STOP_REASON_PROCESS_SIGINT = createReason("process sigint");
const STOP_REASON_PROCESS_BEFORE_EXIT = createReason("process before exit");
const STOP_REASON_PROCESS_HANGUP_OR_DEATH = createReason("process hangup or death");
const STOP_REASON_PROCESS_DEATH = createReason("process death");
const STOP_REASON_PROCESS_EXIT = createReason("process exit");
const STOP_REASON_NOT_SPECIFIED = createReason("not specified");

const killPort = nodeRequire$1("kill-port");

const STATUS_TEXT_INTERNAL_ERROR = "internal error";
const startServer = async ({
  cancellationToken = createCancellationToken(),
  logLevel,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  // assign a random available port
  forcePort = false,
  privateKey = jsenvPrivateKey,
  certificate = jsenvCertificate,
  stopOnSIGINT = true,
  // auto close the server when the process exits
  stopOnExit = true,
  // auto close when server respond with a 500
  stopOnInternalError = false,
  // auto close the server when an uncaughtException happens
  stopOnCrash = false,
  keepProcessAlive = true,
  requestToResponse = () => null,
  accessControlAllowedOrigins = [],
  accessControlAllowedMethods = jsenvAccessControlAllowedMethods,
  accessControlAllowedHeaders = jsenvAccessControlAllowedHeaders,
  accessControlAllowRequestOrigin = false,
  accessControlAllowRequestMethod = false,
  accessControlAllowRequestHeaders = false,
  accessControlAllowCredentials = false,
  // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
  // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  accessControlMaxAge = 600,
  sendInternalErrorStack = false,
  internalErrorToResponseProperties = error => {
    const body = error ? JSON.stringify({
      code: error.code || "UNKNOWN_ERROR",
      ...(sendInternalErrorStack ? {
        stack: error.stack
      } : {})
    }) : JSON.stringify({
      code: "VALUE_THROWED",
      value: error
    });
    return {
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body)
      },
      body
    };
  },
  startedCallback = () => {},
  stoppedCallback = () => {}
} = {}) => {
  if (port === 0 && forcePort) throw new Error(`no need to pass forcePort when port is 0`);
  if (protocol !== "http" && protocol !== "https") throw new Error(`protocol must be http or https, got ${protocol}`); // https://github.com/nodejs/node/issues/14900

  if (ip === "0.0.0.0" && process.platform === "win32") throw new Error(`listening ${ip} not available on window`);
  const logger = createLogger({
    logLevel
  });

  if (forcePort) {
    await createOperation({
      cancellationToken,
      start: () => killPort(port)
    });
  }

  const {
    nodeServer,
    agent
  } = getNodeServerAndAgent({
    protocol,
    privateKey,
    certificate
  }); // https://nodejs.org/api/net.html#net_server_unref

  if (!keepProcessAlive) {
    nodeServer.unref();
  }

  let status = "starting";
  const {
    registerCleanupCallback,
    cleanup
  } = createTracker();
  const connectionTracker = trackConnections(nodeServer); // opened connection must be shutdown before the close event is emitted

  registerCleanupCallback(connectionTracker.stop);
  const clientTracker = trackClients(nodeServer);
  registerCleanupCallback(reason => {
    let responseStatus;

    if (reason === STOP_REASON_INTERNAL_ERROR) {
      responseStatus = 500; // reason = 'shutdown because error'
    } else {
      responseStatus = 503; // reason = 'unavailable because closing'
    }

    clientTracker.stop({
      status: responseStatus,
      reason
    });
  });
  const requestHandlerTracker = trackRequestHandlers(nodeServer); // ensure we don't try to handle request while server is closing

  registerCleanupCallback(requestHandlerTracker.stop);
  let stoppedResolve;
  const stoppedPromise = new Promise(resolve => {
    stoppedResolve = resolve;
  });
  const stop = memoizeOnce$1(async (reason = STOP_REASON_NOT_SPECIFIED) => {
    status = "closing";
    logger.info(`server stopped because ${reason}`);
    await cleanup(reason);
    await stopListening(nodeServer);
    status = "stopped";
    stoppedCallback({
      reason
    });
    stoppedResolve(reason);
  });
  const startOperation = createStoppableOperation({
    cancellationToken,
    start: () => listen({
      cancellationToken,
      server: nodeServer,
      port,
      ip
    }),
    stop: (_, reason) => stop(reason)
  });

  if (stopOnCrash) {
    const unregister = unadvisedCrashSignal.addCallback(reason => {
      stop(reason.value);
    });
    registerCleanupCallback(unregister);
  }

  if (stopOnInternalError) {
    const unregister = requestHandlerTracker.add((nodeRequest, nodeResponse) => {
      if (nodeResponse.statusCode === 500 && nodeResponse.statusMessage === STATUS_TEXT_INTERNAL_ERROR) {
        stop(STOP_REASON_INTERNAL_ERROR);
      }
    });
    registerCleanupCallback(unregister);
  }

  if (stopOnExit) {
    const unregister = teardownSignal.addCallback(tearDownReason => {
      stop({
        beforeExit: STOP_REASON_PROCESS_BEFORE_EXIT,
        hangupOrDeath: STOP_REASON_PROCESS_HANGUP_OR_DEATH,
        death: STOP_REASON_PROCESS_DEATH,
        exit: STOP_REASON_PROCESS_EXIT
      }[tearDownReason]);
    });
    registerCleanupCallback(unregister);
  }

  if (stopOnSIGINT) {
    const unregister = interruptSignal.addCallback(() => {
      stop(STOP_REASON_PROCESS_SIGINT);
    });
    registerCleanupCallback(unregister);
  }

  port = await startOperation;
  status = "opened";
  const origin = originAsString({
    protocol,
    ip,
    port
  });
  logger.info(`server started at ${origin}`);
  startedCallback({
    origin
  }); // nodeServer.on("upgrade", (request, socket, head) => {
  //   // when being requested using a websocket
  //   // we could also answr to the request ?
  //   // socket.end([data][, encoding])
  //   console.log("upgrade", { head, request })
  //   console.log("socket", { connecting: socket.connecting, destroyed: socket.destroyed })
  // })

  requestHandlerTracker.add(async (nodeRequest, nodeResponse) => {
    const {
      request,
      response,
      error
    } = await generateResponseDescription({
      nodeRequest,
      origin
    });

    if (request.method !== "HEAD" && response.headers["content-length"] > 0 && response.body === "") {
      logger.error(createContentLengthMismatchError(`content-length header is ${response.headers["content-length"]} but body is empty`));
    }

    logger.info(`${request.method} ${request.origin}${request.ressource}`);

    if (error) {
      logger.error(error);
    }

    logger.info(`${colorizeResponseStatus(response.status)} ${response.statusText}`);
    populateNodeResponse(nodeResponse, response, {
      ignoreBody: request.method === "HEAD"
    });
  });
  const corsEnabled = accessControlAllowRequestOrigin || accessControlAllowedOrigins.length; // here we check access control options to throw or warn if we find strange values

  const generateResponseDescription = async ({
    nodeRequest,
    origin
  }) => {
    const request = nodeRequestToRequest(nodeRequest, origin);
    nodeRequest.on("error", error => {
      logger.error("error on", request.ressource, error);
    });

    const responsePropertiesToResponse = ({
      status = 501,
      statusText = statusToStatusText(status),
      headers = {},
      body = "",
      bodyEncoding
    }) => {
      if (corsEnabled) {
        const accessControlHeaders = generateAccessControlHeaders({
          request,
          accessControlAllowedOrigins,
          accessControlAllowRequestOrigin,
          accessControlAllowedMethods,
          accessControlAllowRequestMethod,
          accessControlAllowedHeaders,
          accessControlAllowRequestHeaders,
          accessControlAllowCredentials,
          accessControlMaxAge
        });
        return {
          status,
          statusText,
          headers: composeResponseHeaders(headers, accessControlHeaders),
          body,
          bodyEncoding
        };
      }

      return {
        status,
        statusText,
        headers,
        body,
        bodyEncoding
      };
    };

    try {
      if (corsEnabled && request.method === "OPTIONS") {
        return {
          request,
          response: responsePropertiesToResponse({
            status: 200,
            headers: {
              "content-length": 0
            }
          })
        };
      }

      const responseProperties = await requestToResponse(request);
      return {
        request,
        response: responsePropertiesToResponse(responseProperties)
      };
    } catch (error) {
      return {
        request,
        response: composeResponse(responsePropertiesToResponse({
          status: 500,
          statusText: STATUS_TEXT_INTERNAL_ERROR,
          headers: {
            // ensure error are not cached
            "cache-control": "no-store",
            "content-type": "text/plain"
          }
        }), internalErrorToResponseProperties(error)),
        error
      };
    }
  };

  return {
    getStatus: () => status,
    origin,
    nodeServer,
    // TODO: remove agent
    agent,
    stop,
    stoppedPromise
  };
};

const createTracker = () => {
  const callbackArray = [];

  const registerCleanupCallback = callback => {
    if (typeof callback !== "function") throw new TypeError(`callback must be a function
callback: ${callback}`);
    callbackArray.push(callback);
  };

  const cleanup = async reason => {
    const localCallbackArray = callbackArray.slice();
    await Promise.all(localCallbackArray.map(callback => callback(reason)));
  };

  return {
    registerCleanupCallback,
    cleanup
  };
};

const statusToStatusText = status => http.STATUS_CODES[status] || "not specified";

const getNodeServerAndAgent = ({
  protocol,
  privateKey,
  certificate
}) => {
  if (protocol === "http") {
    return {
      nodeServer: http.createServer(),
      agent: global.Agent
    };
  }

  if (protocol === "https") {
    if (!privateKey) {
      throw new Error(`missing privateKey for https server`);
    }

    if (!certificate) {
      throw new Error(`missing certificate for https server`);
    }

    if (privateKey !== jsenvPrivateKey && certificate === jsenvCertificate) {
      throw new Error(`you passed a privateKey without certificate`);
    }

    if (certificate !== jsenvCertificate && privateKey === jsenvPrivateKey) {
      throw new Error(`you passed a certificate without privateKey`);
    }

    return {
      nodeServer: https.createServer({
        key: privateKey,
        cert: certificate
      }),
      agent: new https.Agent({
        rejectUnauthorized: false // allow self signed certificate

      })
    };
  }

  throw new Error(`unsupported protocol ${protocol}`);
};

const createContentLengthMismatchError = message => {
  const error = new Error(message);
  error.code = "CONTENT_LENGTH_MISMATCH";
  error.name = error.code;
  return error;
}; // https://www.w3.org/TR/cors/
// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS


const generateAccessControlHeaders = ({
  request: {
    headers
  },
  accessControlAllowedOrigins,
  accessControlAllowRequestOrigin,
  accessControlAllowedMethods,
  accessControlAllowRequestMethod,
  accessControlAllowedHeaders,
  accessControlAllowRequestHeaders,
  accessControlAllowCredentials,
  // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
  // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  accessControlMaxAge = 600
} = {}) => {
  const vary = [];
  const allowedOriginArray = [...accessControlAllowedOrigins];

  if (accessControlAllowRequestOrigin) {
    if ("origin" in headers && headers.origin !== "null") {
      allowedOriginArray.push(headers.origin);
      vary.push("origin");
    } else if ("referer" in headers) {
      allowedOriginArray.push(urlToOrigin(headers.referer));
      vary.push("referer");
    } else {
      allowedOriginArray.push("*");
    }
  }

  const allowedMethodArray = [...accessControlAllowedMethods];

  if (accessControlAllowRequestMethod && "access-control-request-method" in headers) {
    const requestMethodName = headers["access-control-request-method"];

    if (!allowedMethodArray.includes(requestMethodName)) {
      allowedMethodArray.push(requestMethodName);
      vary.push("access-control-request-method");
    }
  }

  const allowedHeaderArray = [...accessControlAllowedHeaders];

  if (accessControlAllowRequestHeaders && "access-control-request-headers" in headers) {
    const requestHeaderNameArray = headers["access-control-request-headers"].split(", ");
    requestHeaderNameArray.forEach(headerName => {
      const headerNameLowerCase = headerName.toLowerCase();

      if (!allowedHeaderArray.includes(headerNameLowerCase)) {
        allowedHeaderArray.push(headerNameLowerCase);

        if (!vary.includes("access-control-request-headers")) {
          vary.push("access-control-request-headers");
        }
      }
    });
  }

  return {
    "access-control-allow-origin": allowedOriginArray.join(", "),
    "access-control-allow-methods": allowedMethodArray.join(", "),
    "access-control-allow-headers": allowedHeaderArray.join(", "),
    ...(accessControlAllowCredentials ? {
      "access-control-allow-credentials": true
    } : {}),
    "access-control-max-age": accessControlMaxAge,
    ...(vary.length ? {
      vary: vary.join(", ")
    } : {})
  };
};

let jsenvCoreDirectoryUrl;

if (typeof __filename === "string") {
  jsenvCoreDirectoryUrl = resolveDirectoryUrl( // get ride of dist/node/main.js
  "../../", pathToFileUrl(__filename));
} else {
  jsenvCoreDirectoryUrl = resolveDirectoryUrl( // get ride of src/internal/jsenvCoreDirectoryUrl.js
  "../../", url);
}

const COMPILE_ID_BEST = "best";
const COMPILE_ID_OTHERWISE = "otherwise";
const COMPILE_ID_GLOBAL_BUNDLE = "otherwise-global-bundle";
const COMPILE_ID_GLOBAL_BUNDLE_FILES = "otherwise-global-bundle-files";
const COMPILE_ID_COMMONJS_BUNDLE = "otherwise-commonjs-bundle";
const COMPILE_ID_COMMONJS_BUNDLE_FILES = "otherwise-commonjs-bundle-files";

const valueToVersion = value => {
  if (typeof value === "number") {
    return numberToVersion(value);
  }

  if (typeof value === "string") {
    return stringToVersion(value);
  }

  throw new TypeError(createValueErrorMessage({
    version: value
  }));
};

const numberToVersion = number => {
  return {
    major: number,
    minor: 0,
    patch: 0
  };
};

const stringToVersion = string => {
  if (string.indexOf(".") > -1) {
    const parts = string.split(".");
    return {
      major: Number(parts[0]),
      minor: parts[1] ? Number(parts[1]) : 0,
      patch: parts[2] ? Number(parts[2]) : 0
    };
  }

  if (isNaN(string)) {
    return {
      major: 0,
      minor: 0,
      patch: 0
    };
  }

  return {
    major: Number(string),
    minor: 0,
    patch: 0
  };
};

const createValueErrorMessage = ({
  value
}) => `value must be a number or a string.
value: ${value}`;

const versionCompare = (versionA, versionB) => {
  const semanticVersionA = valueToVersion(versionA);
  const semanticVersionB = valueToVersion(versionB);
  const majorDiff = semanticVersionA.major - semanticVersionB.major;

  if (majorDiff > 0) {
    return majorDiff;
  }

  if (majorDiff < 0) {
    return majorDiff;
  }

  const minorDiff = semanticVersionA.minor - semanticVersionB.minor;

  if (minorDiff > 0) {
    return minorDiff;
  }

  if (minorDiff < 0) {
    return minorDiff;
  }

  const patchDiff = semanticVersionA.patch - semanticVersionB.patch;

  if (patchDiff > 0) {
    return patchDiff;
  }

  if (patchDiff < 0) {
    return patchDiff;
  }

  return 0;
};

const versionIsBelow = (versionSupposedBelow, versionSupposedAbove) => {
  return versionCompare(versionSupposedBelow, versionSupposedAbove) < 0;
};

const findHighestVersion = (...values) => {
  if (values.length === 0) throw new Error(`missing argument`);
  return values.reduce((highestVersion, value) => {
    if (versionIsBelow(highestVersion, value)) {
      return value;
    }

    return highestVersion;
  });
};

// copied from
// https://github.com/babel/babel/blob/0ee2c42b55e1893f0ae6510916405eb273587844/packages/babel-preset-env/data/plugins.json
// Because this is an hidden implementation detail of @babel/preset-env
// it could be deprecated or moved anytime.
// For that reason it makes more sens to have it inlined here
// than importing it from an undocumented location.
// Ideally it would be documented or a separate module
const jsenvBabelPluginCompatMap = {
  "transform-template-literals": {
    chrome: "41",
    edge: "13",
    firefox: "34",
    node: "4",
    samsung: "3.4",
    opera: "28",
    electron: "0.24"
  },
  "transform-literals": {
    chrome: "44",
    edge: "12",
    firefox: "53",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    opera: "31",
    electron: "0.31"
  },
  "transform-function-name": {
    chrome: "51",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    opera: "38",
    electron: "1.2"
  },
  "transform-arrow-functions": {
    chrome: "47",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    opera: "34",
    electron: "0.36"
  },
  "transform-block-scoped-functions": {
    chrome: "41",
    edge: "12",
    firefox: "46",
    safari: "10",
    node: "4",
    ie: "11",
    ios: "10",
    samsung: "3.4",
    opera: "28",
    electron: "0.24"
  },
  "transform-classes": {
    chrome: "46",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    opera: "33",
    electron: "0.36"
  },
  "transform-object-super": {
    chrome: "46",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    opera: "33",
    electron: "0.36"
  },
  "transform-shorthand-properties": {
    chrome: "43",
    edge: "12",
    firefox: "33",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    opera: "30",
    electron: "0.29"
  },
  "transform-duplicate-keys": {
    chrome: "42",
    edge: "12",
    firefox: "34",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "3.4",
    opera: "29",
    electron: "0.27"
  },
  "transform-computed-properties": {
    chrome: "44",
    edge: "12",
    firefox: "34",
    safari: "7.1",
    node: "4",
    ios: "8",
    samsung: "4",
    opera: "31",
    electron: "0.31"
  },
  "transform-for-of": {
    chrome: "51",
    edge: "15",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    opera: "38",
    electron: "1.2"
  },
  "transform-sticky-regex": {
    chrome: "49",
    edge: "13",
    firefox: "3",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    opera: "36",
    electron: "1"
  },
  "transform-dotall-regex": {
    chrome: "62",
    safari: "11.1",
    node: "8.10",
    ios: "11.3",
    samsung: "8.2",
    opera: "49",
    electron: "3.1"
  },
  "transform-unicode-regex": {
    chrome: "50",
    edge: "13",
    firefox: "46",
    safari: "12",
    node: "6",
    ios: "12",
    samsung: "5",
    opera: "37",
    electron: "1.1"
  },
  "transform-spread": {
    chrome: "46",
    edge: "13",
    firefox: "36",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    opera: "33",
    electron: "0.36"
  },
  "transform-parameters": {
    chrome: "49",
    edge: "18",
    firefox: "53",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    opera: "36",
    electron: "1"
  },
  "transform-destructuring": {
    chrome: "51",
    edge: "15",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    opera: "38",
    electron: "1.2"
  },
  "transform-block-scoping": {
    chrome: "49",
    edge: "14",
    firefox: "51",
    safari: "11",
    node: "6",
    ios: "11",
    samsung: "5",
    opera: "36",
    electron: "1"
  },
  "transform-typeof-symbol": {
    chrome: "38",
    edge: "12",
    firefox: "36",
    safari: "9",
    node: "0.12",
    ios: "9",
    samsung: "3",
    opera: "25",
    electron: "0.2"
  },
  "transform-new-target": {
    chrome: "46",
    edge: "14",
    firefox: "41",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    opera: "33",
    electron: "0.36"
  },
  "transform-regenerator": {
    chrome: "50",
    edge: "13",
    firefox: "53",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    opera: "37",
    electron: "1.1"
  },
  "transform-exponentiation-operator": {
    chrome: "52",
    edge: "14",
    firefox: "52",
    safari: "10.1",
    node: "7",
    ios: "10.3",
    samsung: "6.2",
    opera: "39",
    electron: "1.3"
  },
  "transform-async-to-generator": {
    chrome: "55",
    edge: "15",
    firefox: "52",
    safari: "11",
    node: "7.6",
    ios: "11",
    samsung: "6.2",
    opera: "42",
    electron: "1.6"
  },
  // copy of transform-async-to-generator
  // this is not in the babel-preset-env repo
  // but we need this
  "transform-async-to-promises": {
    chrome: "55",
    edge: "15",
    firefox: "52",
    safari: "11",
    node: "7.6",
    ios: "11",
    samsung: "6.2",
    opera: "42",
    electron: "1.6"
  },
  "proposal-async-generator-functions": {
    chrome: "63",
    firefox: "57",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "8.2",
    opera: "50",
    electron: "3.1"
  },
  "proposal-object-rest-spread": {
    chrome: "60",
    firefox: "55",
    safari: "11.1",
    node: "8.3",
    ios: "11.3",
    samsung: "8.2",
    opera: "47",
    electron: "2.1"
  },
  "proposal-optional-chaining": {},
  "proposal-unicode-property-regex": {
    chrome: "64",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    opera: "51",
    electron: "3.1"
  },
  "proposal-json-strings": {
    chrome: "66",
    firefox: "62",
    safari: "12",
    node: "10",
    ios: "12",
    opera: "53",
    electron: "3.1"
  },
  "proposal-optional-catch-binding": {
    chrome: "66",
    firefox: "58",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    opera: "53",
    electron: "3.1"
  },
  "transform-named-capturing-groups-regex": {
    chrome: "64",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    opera: "51",
    electron: "3.1"
  },
  "transform-member-expression-literals": {
    chrome: "7",
    opera: "12",
    edge: "12",
    firefox: "2",
    safari: "5.1",
    node: "0.10",
    ie: "9",
    android: "4",
    ios: "6",
    phantom: "2",
    samsung: "2.1",
    electron: "5"
  },
  "transform-property-literals": {
    chrome: "7",
    opera: "12",
    edge: "12",
    firefox: "2",
    safari: "5.1",
    node: "0.10",
    ie: "9",
    android: "4",
    ios: "6",
    phantom: "2",
    samsung: "2.1",
    electron: "5"
  },
  "transform-reserved-words": {
    chrome: "13",
    opera: "10.50",
    edge: "12",
    firefox: "2",
    safari: "3.1",
    node: "0.10",
    ie: "9",
    android: "4.4",
    ios: "6",
    phantom: "2",
    samsung: "2.1",
    electron: "0.2"
  }
};

// we could reuse this to get a list of polyfill
// using https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/built-ins.json#L1
// adding a featureNameArray to every group
// and according to that featureNameArray, add these polyfill
// to the generated bundle
const jsenvPluginCompatMap = {};

const computeBabelPluginMapForPlatform = ({
  babelPluginMap,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,
  platformName,
  platformVersion
}) => {
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`);
  }

  if (typeof babelPluginCompatMap !== "object") {
    throw new TypeError(`babelPluginCompatMap must be an object, got ${babelPluginCompatMap}`);
  }

  if (typeof platformName !== "string") {
    throw new TypeError(`platformName must be a string, got ${platformName}`);
  }

  if (typeof platformVersion !== "string") {
    throw new TypeError(`platformVersion must be a string, got ${platformVersion}`);
  }

  const babelPluginMapForPlatform = {};
  Object.keys(babelPluginMap).forEach(key => {
    const compatible = platformIsCompatibleWithFeature({
      platformName,
      platformVersion,
      platformCompatMap: key in babelPluginCompatMap ? babelPluginCompatMap[key] : {}
    });

    if (!compatible) {
      babelPluginMapForPlatform[key] = babelPluginMap[key];
    }
  });
  return babelPluginMapForPlatform;
};

const platformIsCompatibleWithFeature = ({
  platformName,
  platformVersion,
  platformCompatMap
}) => {
  const platformCompatibleVersion = computePlatformCompatibleVersion({
    platformCompatMap,
    platformName
  });
  const highestVersion = findHighestVersion(platformVersion, platformCompatibleVersion);
  return highestVersion === platformVersion;
};

const computePlatformCompatibleVersion = ({
  platformCompatMap,
  platformName
}) => {
  return platformName in platformCompatMap ? platformCompatMap[platformName] : "Infinity";
};

const computeJsenvPluginMapForPlatform = ({
  jsenvPluginMap,
  jsenvPluginCompatMap: jsenvPluginCompatMap$1 = jsenvPluginCompatMap,
  platformName,
  platformVersion
}) => {
  if (typeof jsenvPluginMap !== "object") {
    throw new TypeError(`jsenvPluginMap must be a object, got ${jsenvPluginMap}`);
  }

  if (typeof jsenvPluginCompatMap$1 !== "object") {
    throw new TypeError(`jsenvPluginCompatMap must be a string, got ${jsenvPluginCompatMap$1}`);
  }

  if (typeof platformName !== "string") {
    throw new TypeError(`platformName must be a string, got ${platformName}`);
  }

  if (typeof platformVersion !== "string") {
    throw new TypeError(`platformVersion must be a string, got ${platformVersion}`);
  }

  const jsenvPluginMapForPlatform = {};
  Object.keys(jsenvPluginMap).forEach(key => {
    const compatible = platformIsCompatibleWithFeature$1({
      platformName,
      platformVersion,
      featureCompat: key in jsenvPluginCompatMap$1 ? jsenvPluginCompatMap$1[key] : {}
    });

    if (!compatible) {
      jsenvPluginMapForPlatform[key] = jsenvPluginMap[key];
    }
  });
  return jsenvPluginMapForPlatform;
};

const platformIsCompatibleWithFeature$1 = ({
  platformName,
  platformVersion,
  featureCompat
}) => {
  const platformCompatibleVersion = computePlatformCompatibleVersion$1({
    featureCompat,
    platformName
  });
  const highestVersion = findHighestVersion(platformVersion, platformCompatibleVersion);
  return highestVersion === platformVersion;
};

const computePlatformCompatibleVersion$1 = ({
  featureCompat,
  platformName
}) => {
  return platformName in featureCompat ? featureCompat[platformName] : "Infinity";
};

const groupHaveSameRequirements = (leftGroup, rightGroup) => {
  return leftGroup.babelPluginRequiredNameArray.join("") === rightGroup.babelPluginRequiredNameArray.join("") && leftGroup.jsenvPluginRequiredNameArray.join("") === rightGroup.jsenvPluginRequiredNameArray.join("");
};

const generatePlatformGroupArray = ({
  babelPluginMap,
  jsenvPluginMap,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,
  jsenvPluginCompatMap: jsenvPluginCompatMap$1 = jsenvPluginCompatMap,
  platformName
}) => {
  const versionArray = [];
  Object.keys(babelPluginMap).forEach(babelPluginKey => {
    if (babelPluginKey in babelPluginCompatMap) {
      const babelPluginCompat = babelPluginCompatMap[babelPluginKey];

      if (platformName in babelPluginCompat) {
        const version = String(babelPluginCompat[platformName]);

        if (!versionArray.includes(version)) {
          versionArray.push(version);
        }
      }
    }
  });
  Object.keys(jsenvPluginMap).forEach(jsenvPluginKey => {
    if (jsenvPluginKey in jsenvPluginCompatMap$1) {
      const jsenvPluginCompat = jsenvPluginCompatMap$1[jsenvPluginKey];

      if (platformName in jsenvPluginCompat) {
        const version = String(jsenvPluginCompat[platformName]);

        if (!versionArray.includes(version)) {
          versionArray.push(version);
        }
      }
    }
  });
  versionArray.push("0.0.0");
  versionArray.sort(versionCompare);
  const platformGroupArray = [];
  versionArray.forEach(version => {
    const babelPluginMapForPlatform = computeBabelPluginMapForPlatform({
      babelPluginMap,
      babelPluginCompatMap,
      platformName,
      platformVersion: version
    });
    const babelPluginRequiredNameArray = Object.keys(babelPluginMap).filter(babelPluginKey => babelPluginKey in babelPluginMapForPlatform).sort();
    const jsenvPluginMapForPlatform = computeJsenvPluginMapForPlatform({
      jsenvPluginMap,
      jsenvPluginCompatMap: jsenvPluginCompatMap$1,
      platformName,
      platformVersion: version
    });
    const jsenvPluginRequiredNameArray = Object.keys(jsenvPluginMap).filter(jsenvPluginKey => jsenvPluginKey in jsenvPluginMapForPlatform).sort();
    const group = {
      babelPluginRequiredNameArray,
      jsenvPluginRequiredNameArray,
      platformCompatMap: {
        [platformName]: version
      }
    };
    const groupWithSameRequirements = platformGroupArray.find(platformGroupCandidate => groupHaveSameRequirements(platformGroupCandidate, group));

    if (groupWithSameRequirements) {
      groupWithSameRequirements.platformCompatMap[platformName] = findHighestVersion(groupWithSameRequirements.platformCompatMap[platformName], version);
    } else {
      platformGroupArray.push(group);
    }
  });
  return platformGroupArray;
};

const composePlatformCompatMap = (platformCompatMap, secondPlatformCompatMap) => {
  return objectComposeValue(normalizePlatformCompatMapVersions(platformCompatMap), normalizePlatformCompatMapVersions(secondPlatformCompatMap), (version, secondVersion) => findHighestVersion(version, secondVersion));
};

const normalizePlatformCompatMapVersions = platformCompatibility => {
  return objectMapValue(platformCompatibility, version => String(version));
};

const objectMapValue = (object, callback) => {
  const mapped = {};
  Object.keys(object).forEach(key => {
    mapped[key] = callback(object[key], key, object);
  });
  return mapped;
};

const objectComposeValue = (previous, object, callback) => {
  const composed = { ...previous
  };
  Object.keys(object).forEach(key => {
    composed[key] = key in composed ? callback(composed[key], object[key]) : object[key];
  });
  return composed;
};

const composeGroupArray = (...arrayOfGroupArray) => {
  return arrayOfGroupArray.reduce(groupArrayReducer, []);
};

const groupArrayReducer = (previousGroupArray, groupArray) => {
  const reducedGroupArray = [];
  previousGroupArray.forEach(group => {
    reducedGroupArray.push(copyGroup(group));
  });
  groupArray.forEach(group => {
    const groupWithSameRequirements = reducedGroupArray.find(existingGroupCandidate => groupHaveSameRequirements(group, existingGroupCandidate));

    if (groupWithSameRequirements) {
      groupWithSameRequirements.platformCompatMap = composePlatformCompatMap(groupWithSameRequirements.platformCompatMap, group.platformCompatMap);
    } else {
      reducedGroupArray.push(copyGroup(group));
    }
  });
  return reducedGroupArray;
};

const copyGroup = ({
  babelPluginRequiredNameArray,
  jsenvPluginRequiredNameArray,
  platformCompatMap
}) => {
  return {
    babelPluginRequiredNameArray: babelPluginRequiredNameArray.slice(),
    jsenvPluginRequiredNameArray: jsenvPluginRequiredNameArray.slice(),
    platformCompatMap: { ...platformCompatMap
    }
  };
};

const generateAllPlatformGroupArray = ({
  babelPluginMap,
  jsenvPluginMap,
  babelPluginCompatMap,
  jsenvPluginCompatMap,
  platformNames
}) => {
  const arrayOfGroupArray = platformNames.map(platformName => generatePlatformGroupArray({
    babelPluginMap,
    jsenvPluginMap,
    babelPluginCompatMap,
    jsenvPluginCompatMap,
    platformName
  }));
  const groupArray = composeGroupArray(...arrayOfGroupArray);
  return groupArray;
};

const platformCompatMapToScore = (platformCompatMap, platformScoreMap) => {
  return Object.keys(platformCompatMap).reduce((previous, platformName) => {
    const platformVersion = platformCompatMap[platformName];
    return previous + platformToScore(platformName, platformVersion, platformScoreMap);
  }, 0);
};

const platformToScore = (platformName, platformVersion, platformScoreMap) => {
  if (platformName in platformScoreMap === false) return platformScoreMap.other || 0;
  const versionUsageMap = platformScoreMap[platformName];
  const versionArray = Object.keys(versionUsageMap);
  if (versionArray.length === 0) return platformScoreMap.other || 0;
  const versionArrayAscending = versionArray.sort(versionCompare);
  const highestVersion = versionArrayAscending[versionArray.length - 1];
  if (findHighestVersion(platformVersion, highestVersion) === platformVersion) return versionUsageMap[highestVersion];
  const closestVersion = versionArrayAscending.reverse().find(version => findHighestVersion(platformVersion, version) === platformVersion);
  if (!closestVersion) return platformScoreMap.other || 0;
  return versionUsageMap[closestVersion];
};

/*

# featureCompatMap legend

        featureName
             │
{ ┌──────────┴────────────┐
  "transform-block-scoping": {─┐
    "chrome": "10",            │
    "safari": "3.0",           platformCompatMap
    "firefox": "5.1"           │
}────┼─────────┼─────────────┘
}      │         └─────┐
  platformName  platformVersion

# group legend

{
  "best": {
    "babelPluginRequiredNameArray" : [
      "transform-block-scoping",
    ],
    "platformCompatMap": {
      "chrome": "10",
      "firefox": "6"
    }
  }
}

Take chars below to update legends
─│┌┐└┘├┤┴┬

*/
const generateGroupMap = ({
  babelPluginMap,
  // jsenv plugin are for later, for now, nothing is using them
  jsenvPluginMap = {},
  babelPluginCompatMap,
  jsenvPluginCompatMap,
  platformScoreMap,
  groupCount = 1,
  // pass this to true if you don't care if someone tries to run your code
  // on a platform which is not inside platformScoreMap.
  platformAlwaysInsidePlatformScoreMap = false,
  // pass this to true if you think you will always be able to detect
  // the platform or that if you fail to do so you don't care.
  platformWillAlwaysBeKnown = false
}) => {
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`);
  }

  if (typeof jsenvPluginMap !== "object") {
    throw new TypeError(`jsenvPluginMap must be an object, got ${jsenvPluginMap}`);
  }

  if (typeof platformScoreMap !== "object") {
    throw new TypeError(`platformScoreMap must be an object, got ${platformScoreMap}`);
  }

  if (typeof groupCount < 1) {
    throw new TypeError(`groupCount must be above 1, got ${groupCount}`);
  }

  const groupWithoutFeature = {
    babelPluginRequiredNameArray: Object.keys(babelPluginMap),
    jsenvPluginRequiredNameArray: Object.keys(jsenvPluginMap),
    platformCompatMap: {}
  }; // when we create one group and we cannot ensure
  // code will be runned on a platform inside platformScoreMap
  // then we return otherwise group to be safe

  if (groupCount === 1 && !platformAlwaysInsidePlatformScoreMap) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature
    };
  }

  const allPlatformGroupArray = generateAllPlatformGroupArray({
    babelPluginMap,
    babelPluginCompatMap,
    jsenvPluginMap,
    jsenvPluginCompatMap,
    platformNames: arrayWithoutValue(Object.keys(platformScoreMap), "other")
  });

  if (allPlatformGroupArray.length === 0) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature
    };
  }

  const groupToScore = ({
    platformCompatMap
  }) => platformCompatMapToScore(platformCompatMap, platformScoreMap);

  const allPlatformGroupArraySortedByScore = allPlatformGroupArray.sort((a, b) => groupToScore(b) - groupToScore(a));
  const length = allPlatformGroupArraySortedByScore.length; // if we arrive here and want a single group
  // we take the worst group and consider it's our best group
  // because it's the lowest platform we want to support

  if (groupCount === 1) {
    return {
      [COMPILE_ID_BEST]: allPlatformGroupArraySortedByScore[length - 1]
    };
  }

  const addOtherwiseToBeSafe = !platformAlwaysInsidePlatformScoreMap || !platformWillAlwaysBeKnown;
  const lastGroupIndex = addOtherwiseToBeSafe ? groupCount - 1 : groupCount;
  const groupArray = length + 1 > groupCount ? allPlatformGroupArraySortedByScore.slice(0, lastGroupIndex) : allPlatformGroupArraySortedByScore;
  const groupMap = {};
  groupArray.forEach((group, index) => {
    if (index === 0) {
      groupMap[COMPILE_ID_BEST] = group;
    } else {
      groupMap[`intermediate-${index + 1}`] = group;
    }
  });

  if (addOtherwiseToBeSafe) {
    groupMap[COMPILE_ID_OTHERWISE] = groupWithoutFeature;
  }

  return groupMap;
};

const arrayWithoutValue = (array, value) => array.filter(valueCandidate => valueCandidate !== value);

// https://www.statista.com/statistics/268299/most-popular-internet-browsers/
// this source of stat is what I found in 5min
// we could improve these default usage score using better stats
// and keep in mind this should be updated time to time or even better
// come from a project specific audience
const jsenvBrowserScoreMap = {
  android: 0.001,
  chrome: {
    "71": 0.3,
    "69": 0.19,
    "0": 0.01 // it means oldest version of chrome will get a score of 0.01

  },
  firefox: {
    "61": 0.3
  },
  edge: {
    "12": 0.1
  },
  electron: 0.001,
  ios: 0.001,
  opera: 0.001,
  other: 0.001,
  safari: {
    "10": 0.1
  }
};

// https://nodejs.org/metrics/summaries/version/nodejs.org-access.log.csv
const jsenvNodeVersionScoreMap = {
  "0.10": 0.02,
  "0.12": 0.01,
  4: 0.1,
  6: 0.25,
  7: 0.1,
  8: 1,
  9: 0.1,
  10: 0.5,
  11: 0.25
};

/* eslint-disable import/max-dependencies */
const proposalJSONStrings = nodeRequire("@babel/plugin-proposal-json-strings");

const proposalObjectRestSpread = nodeRequire("@babel/plugin-proposal-object-rest-spread");

const proposalOptionalCatchBinding = nodeRequire("@babel/plugin-proposal-optional-catch-binding");

const proposalUnicodePropertyRegex = nodeRequire("@babel/plugin-proposal-unicode-property-regex");

const syntaxObjectRestSpread = nodeRequire("@babel/plugin-syntax-object-rest-spread");

const syntaxOptionalCatchBinding = nodeRequire("@babel/plugin-syntax-optional-catch-binding");

const transformArrowFunction = nodeRequire("@babel/plugin-transform-arrow-functions");

const transformAsyncToPromises = nodeRequire("babel-plugin-transform-async-to-promises");

const transformBlockScopedFunctions = nodeRequire("@babel/plugin-transform-block-scoped-functions");

const transformBlockScoping = nodeRequire("@babel/plugin-transform-block-scoping");

const transformClasses = nodeRequire("@babel/plugin-transform-classes");

const transformComputedProperties = nodeRequire("@babel/plugin-transform-computed-properties");

const transformDestructuring = nodeRequire("@babel/plugin-transform-destructuring");

const transformDotAllRegex = nodeRequire("@babel/plugin-transform-dotall-regex");

const transformDuplicateKeys = nodeRequire("@babel/plugin-transform-duplicate-keys");

const transformExponentiationOperator = nodeRequire("@babel/plugin-transform-exponentiation-operator");

const transformForOf = nodeRequire("@babel/plugin-transform-for-of");

const transformFunctionName = nodeRequire("@babel/plugin-transform-function-name");

const transformLiterals = nodeRequire("@babel/plugin-transform-literals");

const transformNewTarget = nodeRequire("@babel/plugin-transform-new-target");

const transformObjectSuper = nodeRequire("@babel/plugin-transform-object-super");

const transformParameters = nodeRequire("@babel/plugin-transform-parameters");

const transformRegenerator = nodeRequire("@babel/plugin-transform-regenerator");

const transformShorthandProperties = nodeRequire("@babel/plugin-transform-shorthand-properties");

const transformSpread = nodeRequire("@babel/plugin-transform-spread");

const transformStickyRegex = nodeRequire("@babel/plugin-transform-sticky-regex");

const transformTemplateLiterals = nodeRequire("@babel/plugin-transform-template-literals");

const transformTypeOfSymbol = nodeRequire("@babel/plugin-transform-typeof-symbol");

const transformUnicodeRegex = nodeRequire("@babel/plugin-transform-unicode-regex");

const jsenvBabelPluginMap = {
  "proposal-object-rest-spread": [proposalObjectRestSpread],
  "proposal-optional-catch-binding": [proposalOptionalCatchBinding],
  "proposal-unicode-property-regex": [proposalUnicodePropertyRegex],
  "proposal-json-strings": [proposalJSONStrings],
  "syntax-object-rest-spread": [syntaxObjectRestSpread],
  "syntax-optional-catch-binding": [syntaxOptionalCatchBinding],
  "transform-async-to-promises": [transformAsyncToPromises],
  "transform-arrow-functions": [transformArrowFunction],
  "transform-block-scoped-functions": [transformBlockScopedFunctions],
  "transform-block-scoping": [transformBlockScoping],
  "transform-classes": [transformClasses],
  "transform-computed-properties": [transformComputedProperties],
  "transform-destructuring": [transformDestructuring],
  "transform-dotall-regex": [transformDotAllRegex],
  "transform-duplicate-keys": [transformDuplicateKeys],
  "transform-exponentiation-operator": [transformExponentiationOperator],
  "transform-for-of": [transformForOf],
  "transform-function-name": [transformFunctionName],
  "transform-literals": [transformLiterals],
  "transform-new-target": [transformNewTarget],
  "transform-object-super": [transformObjectSuper],
  "transform-parameters": [transformParameters],
  "transform-regenerator": [transformRegenerator, {
    asyncGenerators: true,
    generators: true,
    async: false
  }],
  "transform-shorthand-properties": [transformShorthandProperties],
  "transform-spread": [transformSpread],
  "transform-sticky-regex": [transformStickyRegex],
  "transform-template-literals": [transformTemplateLiterals],
  "transform-typeof-symbol": [transformTypeOfSymbol],
  "transform-unicode-regex": [transformUnicodeRegex]
};

const readProjectImportMap = async ({
  logger,
  jsenvProjectDirectoryUrl,
  projectDirectoryUrl,
  importMapFileRelativeUrl
}) => {
  if (typeof jsenvProjectDirectoryUrl !== "string") {
    throw new TypeError(`jsenvProjectDirectoryUrl must be a string, got ${jsenvProjectDirectoryUrl}`);
  }

  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  const importMapForProject = importMapFileRelativeUrl ? await getProjectImportMap({
    projectDirectoryUrl,
    importMapFileRelativeUrl
  }) : null;
  const jsenvCoreImportKey = "@jsenv/core/";
  const jsenvCoreRelativeUrlForJsenvProject = jsenvProjectDirectoryUrl === jsenvCoreDirectoryUrl ? "./" : urlToRelativeUrl(jsenvCoreDirectoryUrl, jsenvProjectDirectoryUrl);
  const importsForJsenvCore = {
    [jsenvCoreImportKey]: jsenvCoreRelativeUrlForJsenvProject
  };

  if (!importMapForProject) {
    return {
      imports: importsForJsenvCore
    };
  }

  if (importMapForProject.imports) {
    const jsenvCoreRelativeUrlForProject = importMapForProject.imports[jsenvCoreImportKey];

    if (jsenvCoreRelativeUrlForProject && jsenvCoreRelativeUrlForProject !== jsenvCoreRelativeUrlForJsenvProject) {
      logger.warn(createIncompatibleJsenvCoreDependencyMessage({
        projectDirectoryPath: fileUrlToPath(projectDirectoryUrl),
        jsenvProjectDirectoryPath: fileUrlToPath(jsenvProjectDirectoryUrl),
        jsenvCoreRelativeUrlForProject,
        jsenvCoreRelativeUrlForJsenvProject
      }));
    }
  }

  const importMapForJsenvCore = {
    imports: importsForJsenvCore,
    scopes: generateJsenvCoreScopes({
      importMapForProject,
      importsForJsenvCore
    })
  };
  return composeTwoImportMaps(importMapForJsenvCore, importMapForProject);
};

const generateJsenvCoreScopes = ({
  importMapForProject,
  importsForJsenvCore
}) => {
  const {
    scopes
  } = importMapForProject;

  if (!scopes) {
    return undefined;
  } // I must ensure jsenvCoreImports wins by default in every scope
  // because scope may contains stuff like
  // "/": "/"
  // "/": "/folder/"
  // to achieve this, we set jsenvCoreImports into every scope
  // they can still be overriden by importMapForProject
  // even if I see no use case for that


  const scopesForJsenvCore = {};
  Object.keys(scopes).forEach(scopeKey => {
    scopesForJsenvCore[scopeKey] = importsForJsenvCore;
  });
  return scopesForJsenvCore;
};

const getProjectImportMap = async ({
  projectDirectoryUrl,
  importMapFileRelativeUrl
}) => {
  const importMapFileUrl = resolveUrl$1(importMapFileRelativeUrl, projectDirectoryUrl);
  const importMapFilePath = fileUrlToPath(importMapFileUrl);
  return new Promise((resolve, reject) => {
    fs.readFile(importMapFilePath, (error, buffer) => {
      if (error) {
        if (error.code === "ENOENT") {
          resolve(null);
        } else {
          reject(error);
        }
      } else {
        const importMapString = String(buffer);
        resolve(JSON.parse(importMapString));
      }
    });
  });
};

const createIncompatibleJsenvCoreDependencyMessage = ({
  projectDirectoryPath,
  jsenvProjectDirectoryPath,
  jsenvCoreRelativeUrlForProject,
  jsenvCoreRelativeUrlForJsenvProject
}) => `incompatible dependency to @jsenv/core in your project and an internal jsenv project.
To fix this either remove project dependency to @jsenv/core or ensure they use the same version.
(If you are inside a @jsenv project you can ignore this warning)
--- your project path to @jsenv/core ---
${jsenvCoreRelativeUrlForProject}
--- jsenv project wanted path to @jsenv/core ---
${jsenvCoreRelativeUrlForJsenvProject}
--- jsenv project path ---
${jsenvProjectDirectoryPath}
--- your project path ---
${projectDirectoryPath}`;

// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
const {
  addNamed
} = nodeRequire("@babel/helper-module-imports");

const createImportMetaUrlNamedImportBabelPlugin = ({
  importMetaSpecifier
}) => {
  return () => {
    return {
      visitor: {
        Program(programPath) {
          const metaPropertyMap = {};
          programPath.traverse({
            MemberExpression(path) {
              const {
                node
              } = path;
              const {
                object
              } = node;
              if (object.type !== "MetaProperty") return;
              const {
                property: objectProperty
              } = object;
              if (objectProperty.name !== "meta") return;
              const {
                property
              } = node;
              const {
                name
              } = property;

              if (name in metaPropertyMap) {
                metaPropertyMap[name].push(path);
              } else {
                metaPropertyMap[name] = [path];
              }
            }

          });
          Object.keys(metaPropertyMap).forEach(propertyName => {
            const importMetaPropertyId = propertyName;
            const result = addNamed(programPath, importMetaPropertyId, importMetaSpecifier);
            metaPropertyMap[propertyName].forEach(path => {
              path.replaceWith(result);
            });
          });
        }

      }
    };
  };
};

const createBabePluginMapForBundle = ({
  format
}) => {
  return { ...(format === "global" || format === "commonjs" ? {
      "import-meta-url-named-import": createImportMetaUrlNamedImportBabelPlugin({
        importMetaSpecifier: `@jsenv/core/src/internal/bundling/import-meta-${format}.js`
      })
    } : {})
  };
};

const writeSourceMappingURL = (source, location) => `${source}
${"//#"} sourceMappingURL=${location}`;
const updateSourceMappingURL = (source, callback) => {
  const sourceMappingUrlRegExp = /\/\/# ?sourceMappingURL=([^\s'"]+)/g;
  let lastSourceMappingUrl;
  let matchSourceMappingUrl;

  while (matchSourceMappingUrl = sourceMappingUrlRegExp.exec(source)) {
    lastSourceMappingUrl = matchSourceMappingUrl;
  }

  if (lastSourceMappingUrl) {
    const index = lastSourceMappingUrl.index;
    const before = source.slice(0, index);
    const after = source.slice(index);
    const mappedAfter = after.replace(sourceMappingUrlRegExp, (match, firstGroup) => {
      return `${"//#"} sourceMappingURL=${callback(firstGroup)}`;
    });
    return `${before}${mappedAfter}`;
  }

  return source;
};
const readSourceMappingURL = source => {
  let sourceMappingURL;
  updateSourceMappingURL(source, value => {
    sourceMappingURL = value;
  });
  return sourceMappingURL;
};
const base64ToString = typeof window === "object" ? window.btoa : base64String => Buffer.from(base64String, "base64").toString("utf8");
const parseSourceMappingURL = source => {
  const sourceMappingURL = readSourceMappingURL(source);
  if (!sourceMappingURL) return null;
  const base64Prefix = "data:application/json;charset=utf-8;base64,";

  if (sourceMappingURL.startsWith(base64Prefix)) {
    const mapBase64Source = sourceMappingURL.slice(base64Prefix.length);
    const sourcemapString = base64ToString(mapBase64Source);
    return {
      sourcemapString
    };
  }

  return {
    sourcemapURL: sourceMappingURL
  };
};
const writeOrUpdateSourceMappingURL = (source, location) => {
  if (readSourceMappingURL(source)) {
    return updateSourceMappingURL(source, location);
  }

  return writeSourceMappingURL(source, location);
};

const transformResultToCompilationResult = async ({
  code,
  map,
  metadata = {}
}, {
  projectDirectoryUrl,
  originalFileContent,
  originalFileUrl,
  compiledFileUrl,
  sourcemapFileUrl,
  remap = true,
  remapMethod = "comment" // 'comment', 'inline'

}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof originalFileContent !== "string") {
    throw new TypeError(`originalFileContent must be a string, got ${originalFileContent}`);
  }

  if (typeof originalFileUrl !== "string") {
    throw new TypeError(`originalFileUrl must be a string, got ${originalFileUrl}`);
  }

  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(`compiledFileUrl must be a string, got ${compiledFileUrl}`);
  }

  if (typeof sourcemapFileUrl !== "string") {
    throw new TypeError(`sourcemapFileUrl must be a string, got ${sourcemapFileUrl}`);
  }

  const sources = [];
  const sourcesContent = [];
  const assets = [];
  const assetsContent = [];
  const metaJsonFileUrl = `${compiledFileUrl}__asset__/meta.json`;
  let output = code;

  if (remap && map) {
    if (map.sources.length === 0) {
      // may happen in some cases where babel returns a wrong sourcemap
      // there is at least one case where it happens
      // a file with only import './whatever.js' inside
      sources.push(fileUrlToRelativePath(originalFileUrl, metaJsonFileUrl));
      sourcesContent.push(originalFileContent);
    } else {
      await Promise.all(map.sources.map(async (source, index) => {
        const sourceFileUrl = String(new URL(source, sourcemapFileUrl));

        if (!sourceFileUrl.startsWith(projectDirectoryUrl)) {
          // do not track dependency outside project
          // it means cache stays valid for those external sources
          return;
        }

        map.sources[index] = fileUrlToRelativePath(sourceFileUrl, sourcemapFileUrl);
        sources[index] = fileUrlToRelativePath(sourceFileUrl, metaJsonFileUrl);

        if (map.sourcesContent && map.sourcesContent[index]) {
          sourcesContent[index] = map.sourcesContent[index];
        } else {
          const sourceFilePath = fileUrlToPath(sourceFileUrl);
          const sourceFileContent = await readFileContent(sourceFilePath);
          sourcesContent[index] = sourceFileContent;
        }
      }));
    } // removing sourcesContent from map decrease the sourceMap
    // it also means client have to fetch source from server (additional http request)
    // some client ignore sourcesContent property such as vscode-chrome-debugger
    // Because it's the most complex scenario and we want to ensure client is always able
    // to find source from the sourcemap, we explicitely delete map.sourcesContent to test this.


    delete map.sourcesContent; // we don't need sourceRoot because our path are relative or absolute to the current location
    // we could comment this line because it is not set by babel because not passed during transform

    delete map.sourceRoot;

    if (remapMethod === "inline") {
      const mapAsBase64 = Buffer.from(JSON.stringify(map)).toString("base64");
      output = writeSourceMappingURL(output, `data:application/json;charset=utf-8;base64,${mapAsBase64}`);
    } else if (remapMethod === "comment") {
      const sourcemapFileRelativePathForModule = fileUrlToRelativePath(sourcemapFileUrl, compiledFileUrl);
      output = writeSourceMappingURL(output, sourcemapFileRelativePathForModule);
      const sourcemapFileRelativePathForAsset = fileUrlToRelativePath(sourcemapFileUrl, `${compiledFileUrl}__asset__/`);
      assets.push(sourcemapFileRelativePathForAsset);
      assetsContent.push(stringifyMap(map));
    }
  } else {
    sources.push(fileUrlToRelativePath(originalFileUrl, metaJsonFileUrl));
    sourcesContent.push(originalFileContent);
  }

  const {
    coverage
  } = metadata;

  if (coverage) {
    assets.push(`coverage.json`);
    assetsContent.push(stringifyCoverage(coverage));
  }

  return {
    compiledSource: output,
    contentType: "application/javascript",
    sources,
    sourcesContent,
    assets,
    assetsContent
  };
};

const stringifyMap = object => JSON.stringify(object, null, "  ");

const stringifyCoverage = object => JSON.stringify(object, null, "  ");

const EMPTY_ID$1 = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
const bufferToEtag$1 = buffer => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(`buffer expected, got ${buffer}`);
  }

  if (buffer.length === 0) {
    return EMPTY_ID$1;
  }

  const hash = crypto.createHash("sha1");
  hash.update(buffer, "utf8");
  const hashBase64String = hash.digest("base64");
  const hashBase64StringSubset = hashBase64String.slice(0, 27);
  const length = buffer.length;
  return `"${length.toString(16)}-${hashBase64StringSubset}"`;
};

const resolveAssetFileUrl = ({
  asset,
  compiledFileUrl
}) => resolveUrl$1(asset, `${compiledFileUrl}__asset__/`);
const resolveMetaJsonFileUrl = ({
  compiledFileUrl
}) => resolveAssetFileUrl({
  compiledFileUrl,
  asset: "meta.json"
});
const resolveSourceFileUrl = ({
  source,
  compiledFileUrl
}) => resolveUrl$1(source, resolveMetaJsonFileUrl({
  compiledFileUrl
}));

const readMeta = async ({
  logger,
  compiledFileUrl
}) => {
  const metaJsonFileUrl = resolveMetaJsonFileUrl({
    compiledFileUrl
  });
  const metaJsonFilePath = fileUrlToPath(metaJsonFileUrl);

  try {
    const metaJsonString = await readFileContent(metaJsonFilePath);
    const metaJsonObject = JSON.parse(metaJsonString);
    return metaJsonObject;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    if (error && error.name === "SyntaxError") {
      logger.error(createCacheSyntaxErrorMessage({
        syntaxError: error,
        metaJsonFilePath
      }));
      return null;
    }

    throw error;
  }
};

const createCacheSyntaxErrorMessage = ({
  syntaxError,
  metaJsonFilePath
}) => `cache syntax error
--- syntax error stack ---
${syntaxError.stack}
--- meta.json path ---
${metaJsonFilePath}`;

const validateMeta = async ({
  logger,
  meta,
  compiledFileUrl,
  ifEtagMatch,
  ifModifiedSinceDate
}) => {
  const compiledFileValidation = await validateCompiledFile({
    logger,
    compiledFileUrl,
    ifEtagMatch,
    ifModifiedSinceDate
  });
  if (!compiledFileValidation.valid) return compiledFileValidation;

  if (meta.sources.length === 0) {
    logger.warn(`meta.sources is empty, cache considered as invalid by precaution`);
    return {
      code: "SOURCES_EMPTY",
      valid: false
    };
  }

  const [sourcesValidations, assetValidations] = await Promise.all([validateSources({
    logger,
    meta,
    compiledFileUrl
  }), validateAssets({
    logger,
    meta,
    compiledFileUrl
  })]);
  const invalidSourceValidation = sourcesValidations.find(({
    valid
  }) => !valid);
  if (invalidSourceValidation) return invalidSourceValidation;
  const invalidAssetValidation = assetValidations.find(({
    valid
  }) => !valid);
  if (invalidAssetValidation) return invalidAssetValidation;
  const compiledSource = compiledFileValidation.data.compiledSource;
  const sourcesContent = sourcesValidations.map(({
    data
  }) => data.sourceContent);
  const assetsContent = assetValidations.find(({
    data
  }) => data.assetContent);
  return {
    valid: true,
    data: {
      compiledSource,
      sourcesContent,
      assetsContent
    }
  };
};

const validateCompiledFile = async ({
  logger,
  compiledFileUrl,
  ifEtagMatch,
  ifModifiedSinceDate
}) => {
  const compiledFilePath = fileUrlToPath(compiledFileUrl);

  try {
    const compiledSource = await readFileContent(compiledFilePath);

    if (ifEtagMatch) {
      const compiledEtag = bufferToEtag$1(Buffer.from(compiledSource));

      if (ifEtagMatch !== compiledEtag) {
        logger.debug(`etag changed for ${compiledFilePath}`);
        return {
          code: "COMPILED_FILE_ETAG_MISMATCH",
          valid: false,
          data: {
            compiledSource,
            compiledEtag
          }
        };
      }
    }

    if (ifModifiedSinceDate) {
      const compiledMtime = await readFileStat(compiledFilePath);

      if (ifModifiedSinceDate < dateToSecondsPrecision$1(compiledMtime)) {
        logger.debug(`mtime changed for ${compiledFilePath}`);
        return {
          code: "COMPILED_FILE_MTIME_OUTDATED",
          valid: false,
          data: {
            compiledSource,
            compiledMtime
          }
        };
      }
    }

    return {
      valid: true,
      data: {
        compiledSource
      }
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      logger.debug(`compiled file not found at ${compiledFilePath}`);
      return {
        code: "COMPILED_FILE_NOT_FOUND",
        valid: false,
        data: {
          compiledFilePath
        }
      };
    }

    return Promise.reject(error);
  }
};

const validateSources = ({
  logger,
  meta,
  compiledFileUrl
}) => {
  return Promise.all(meta.sources.map((source, index) => validateSource({
    logger,
    compiledFileUrl,
    source,
    eTag: meta.sourcesEtag[index]
  })));
};

const validateSource = async ({
  logger,
  compiledFileUrl,
  source,
  eTag
}) => {
  const sourceFileUrl = resolveSourceFileUrl({
    source,
    compiledFileUrl
  });
  const sourceFilePath = fileUrlToPath(sourceFileUrl);

  try {
    const sourceContent = await readFileContent(sourceFilePath);
    const sourceETag = bufferToEtag$1(Buffer.from(sourceContent));

    if (sourceETag !== eTag) {
      logger.debug(`etag changed for ${sourceFilePath}`);
      return {
        code: "SOURCE_ETAG_MISMATCH",
        valid: false,
        data: {
          source,
          sourceFilePath,
          sourceContent
        }
      };
    }

    return {
      valid: true,
      data: {
        sourceContent
      }
    };
  } catch (e) {
    if (e && e.code === "ENOENT") {
      // missing source invalidates the cache because
      // we cannot check its validity
      // HOWEVER inside writeMeta we will check if a source can be found
      // when it cannot we will not put it as a dependency
      // to invalidate the cache.
      // It is important because some files are constructed on other files
      // which are not truly on the filesystem
      // (IN theory the above happens only for convertCommonJsWithRollup because jsenv
      // always have a concrete file especially to avoid that kind of thing)
      logger.warn(`source not found at ${sourceFilePath}`);
      return {
        code: "SOURCE_NOT_FOUND",
        valid: false,
        data: {
          source,
          sourceFilePath,
          sourceContent: ""
        }
      };
    }

    throw e;
  }
};

const validateAssets = ({
  logger,
  compiledFileUrl,
  meta
}) => Promise.all(meta.assets.map((asset, index) => validateAsset({
  logger,
  asset,
  compiledFileUrl,
  eTag: meta.assetsEtag[index]
})));

const validateAsset = async ({
  logger,
  asset,
  compiledFileUrl,
  eTag
}) => {
  const assetFileUrl = resolveAssetFileUrl({
    compiledFileUrl,
    asset
  });
  const assetFilePath = fileUrlToPath(assetFileUrl);

  try {
    const assetContent = await readFileContent(assetFilePath);
    const assetContentETag = bufferToEtag$1(Buffer.from(assetContent));

    if (eTag !== assetContentETag) {
      logger.debug(`etag changed for ${assetFilePath}`);
      return {
        code: "ASSET_ETAG_MISMATCH",
        valid: false,
        data: {
          asset,
          assetFilePath,
          assetContent,
          assetContentETag
        }
      };
    }

    return {
      valid: true,
      data: {
        assetContent,
        assetContentETag
      }
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      logger.debug(`asset not found at ${assetFilePath}`);
      return {
        code: "ASSET_FILE_NOT_FOUND",
        valid: false,
        data: {
          asset,
          assetFilePath
        }
      };
    }

    return Promise.reject(error);
  }
};

const dateToSecondsPrecision$1 = date => {
  const dateWithSecondsPrecision = new Date(date);
  dateWithSecondsPrecision.setMilliseconds(0);
  return dateWithSecondsPrecision;
};

const updateMeta = async ({
  logger,
  meta,
  compiledFileUrl,
  cacheHitTracking,
  compileResult,
  compileResultStatus
}) => {
  const isNew = compileResultStatus === "created";
  const isUpdated = compileResultStatus === "updated";
  const isCached = compileResultStatus === "cached";
  const {
    compiledSource,
    contentType,
    assets,
    assetsContent
  } = compileResult;
  let {
    sources,
    sourcesContent
  } = compileResult; // ensure source that does not leads to concrete files are not capable to invalidate the cache

  const sourceExists = await Promise.all(sources.map(async source => {
    const sourceFileUrl = resolveSourceFileUrl({
      source,
      compiledFileUrl
    });
    const exists = await fileExists(sourceFileUrl);

    if (!exists) {
      // this can lead to cache never invalidated by itself
      // it's a very important warning
      logger.warn(`a source file cannot be found ${sourceFileUrl}.
-> excluding it from meta.sources & meta.sourcesEtag`);
    }

    return exists;
  }));
  sources = sources.filter((source, index) => sourceExists[index]);
  sourcesContent = sourcesContent.filter((sourceContent, index) => sourceExists[index]);
  const promises = [];

  if (isNew || isUpdated) {
    const {
      writeCompiledSourceFile = true,
      writeAssetsFile = true
    } = compileResult;

    if (writeCompiledSourceFile) {
      const compiledFilePath = fileUrlToPath(compiledFileUrl);
      logger.debug(`write compiled file at ${compiledFilePath}`);
      promises.push(writeFileContent(compiledFilePath, compiledSource));
    }

    if (writeAssetsFile) {
      promises.push(...assets.map((asset, index) => {
        const assetFileUrl = resolveAssetFileUrl({
          compiledFileUrl,
          asset
        });
        const assetFilePath = fileUrlToPath(assetFileUrl);
        logger.debug(`write compiled file asset at ${assetFilePath}`);
        return writeFileContent(assetFilePath, assetsContent[index]);
      }));
    }
  }

  if (isNew || isUpdated || isCached && cacheHitTracking) {
    let latestMeta;

    if (isNew) {
      latestMeta = {
        contentType,
        sources,
        sourcesEtag: sourcesContent.map(sourceContent => bufferToEtag$1(Buffer.from(sourceContent))),
        assets,
        assetsEtag: assetsContent.map(assetContent => bufferToEtag$1(Buffer.from(assetContent))),
        createdMs: Number(Date.now()),
        lastModifiedMs: Number(Date.now()),
        ...(cacheHitTracking ? {
          matchCount: 1,
          lastMatchMs: Number(Date.now())
        } : {})
      };
    } else if (isUpdated) {
      latestMeta = { ...meta,
        sources,
        sourcesEtag: sourcesContent.map(sourceContent => bufferToEtag$1(Buffer.from(sourceContent))),
        assets,
        assetsEtag: assetsContent.map(assetContent => bufferToEtag$1(Buffer.from(assetContent))),
        lastModifiedMs: Number(Date.now()),
        ...(cacheHitTracking ? {
          matchCount: meta.matchCount + 1,
          lastMatchMs: Number(Date.now())
        } : {})
      };
    } else {
      latestMeta = { ...meta,
        ...(cacheHitTracking ? {
          matchCount: meta.matchCount + 1,
          lastMatchMs: Number(Date.now())
        } : {})
      };
    }

    const metaJsonFileUrl = resolveMetaJsonFileUrl({
      compiledFileUrl
    });
    const metaJsonFilePath = fileUrlToPath(metaJsonFileUrl);
    logger.debug(`write compiled file meta at ${metaJsonFilePath}`);
    promises.push(writeFileContent(metaJsonFilePath, JSON.stringify(latestMeta, null, "  ")));
  }

  return Promise.all(promises);
};

const createLockRegistry = () => {
  let lockArray = [];

  const lockForRessource = async ressource => {
    const currentLock = lockArray.find(lock => lock.ressource === ressource);
    let unlockResolve;
    const unlocked = new Promise(resolve => {
      unlockResolve = resolve;
    });
    const lock = {
      ressource,
      unlocked
    };
    lockArray = [...lockArray, lock];
    if (currentLock) await currentLock.unlocked;

    const unlock = () => {
      lockArray = lockArray.filter(lockCandidate => lockCandidate !== lock);
      unlockResolve();
    };

    return unlock;
  };

  return {
    lockForRessource
  };
};

const {
  lockForRessource
} = createLockRegistry();

const lockfile = nodeRequire("proper-lockfile");

const getOrGenerateCompiledFile = async ({
  logger,
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl = originalFileUrl,
  writeOnFilesystem,
  useFilesystemAsCache,
  cacheHitTracking = false,
  cacheInterProcessLocking = false,
  ifEtagMatch,
  ifModifiedSinceDate,
  compile
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof originalFileUrl !== "string") {
    throw new TypeError(`originalFileUrl must be a string, got ${originalFileUrl}`);
  }

  if (!originalFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`origin file must be inside project
--- original file url ---
${originalFileUrl}
--- project directory url ---
${projectDirectoryUrl}`);
  }

  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(`compiledFileUrl must be a string, got ${compiledFileUrl}`);
  }

  if (!compiledFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`compiled file must be inside project
--- compiled file url ---
${compiledFileUrl}
--- project directory url ---
${projectDirectoryUrl}`);
  }

  if (typeof compile !== "function") {
    throw new TypeError(`compile must be a function, got ${compile}`);
  }

  return startAsap(async () => {
    const {
      meta,
      compileResult,
      compileResultStatus
    } = await computeCompileReport({
      originalFileUrl,
      compiledFileUrl,
      compile,
      ifEtagMatch,
      ifModifiedSinceDate,
      useFilesystemAsCache,
      logger
    });

    if (writeOnFilesystem) {
      await updateMeta({
        logger,
        meta,
        compileResult,
        compileResultStatus,
        compiledFileUrl,
        cacheHitTracking
      });
    }

    return {
      meta,
      compileResult,
      compileResultStatus
    };
  }, {
    compiledFileUrl,
    cacheInterProcessLocking,
    logger
  });
};

const computeCompileReport = async ({
  originalFileUrl,
  compiledFileUrl,
  compile,
  ifEtagMatch,
  ifModifiedSinceDate,
  useFilesystemAsCache,
  logger
}) => {
  const meta = useFilesystemAsCache ? await readMeta({
    logger,
    compiledFileUrl
  }) : null;

  if (!meta) {
    const compileResult = await callCompile({
      logger,
      originalFileUrl,
      compile
    });
    return {
      meta: null,
      compileResult,
      compileResultStatus: "created"
    };
  }

  const metaValidation = await validateMeta({
    logger,
    meta,
    compiledFileUrl,
    ifEtagMatch,
    ifModifiedSinceDate
  });

  if (!metaValidation.valid) {
    const compileResult = await callCompile({
      logger,
      originalFileUrl,
      compile
    });
    return {
      meta,
      compileResult,
      compileResultStatus: "updated"
    };
  }

  const {
    contentType,
    sources,
    assets
  } = meta;
  const {
    compiledSource,
    sourcesContent,
    assetsContent
  } = metaValidation.data;
  return {
    meta,
    compileResult: {
      contentType,
      compiledSource,
      sources,
      sourcesContent,
      assets,
      assetsContent
    },
    compileResultStatus: "cached"
  };
};

const callCompile = async ({
  logger,
  originalFileUrl,
  compile
}) => {
  logger.debug(`compile ${originalFileUrl}`);
  const {
    sources = [],
    sourcesContent = [],
    assets = [],
    assetsContent = [],
    contentType,
    compiledSource,
    ...rest
  } = await compile();

  if (typeof contentType !== "string") {
    throw new TypeError(`compile must return a contentType string, got ${contentType}`);
  }

  if (typeof compiledSource !== "string") {
    throw new TypeError(`compile must return a compiledSource string, got ${compiledSource}`);
  }

  return {
    contentType,
    compiledSource,
    sources,
    sourcesContent,
    assets,
    assetsContent,
    ...rest
  };
};

const startAsap = async (fn, {
  logger,
  compiledFileUrl,
  cacheInterProcessLocking
}) => {
  const metaJsonFileUrl = resolveMetaJsonFileUrl({
    compiledFileUrl
  });
  const metaJsonFilePath = fileUrlToPath(metaJsonFileUrl);
  logger.debug(`lock ${metaJsonFilePath}`); // in case this process try to concurrently access meta we wait for previous to be done

  const unlockLocal = await lockForRessource(metaJsonFilePath);

  let unlockInterProcessLock = () => {};

  if (cacheInterProcessLocking) {
    // after that we use a lock pathnameRelative to be sure we don't conflict with other process
    // trying to do the same (mapy happen when spawining multiple server for instance)
    // https://github.com/moxystudio/node-proper-lockfile/issues/69
    await createFileDirectories(metaJsonFilePath); // https://github.com/moxystudio/node-proper-lockfile#lockfile-options

    unlockInterProcessLock = await lockfile.lock(metaJsonFilePath, {
      realpath: false,
      retries: {
        retries: 20,
        minTimeout: 20,
        maxTimeout: 500
      }
    });
  }

  try {
    return await fn();
  } finally {
    // we want to unlock in case of error too
    logger.debug(`unlock ${metaJsonFilePath}`);
    unlockLocal();
    unlockInterProcessLock();
  } // here in case of error.code === 'ELOCKED' thrown from here
  // https://github.com/moxystudio/node-proper-lockfile/blob/1a478a43a077a7a7efc46ac79fd8f713a64fd499/lib/lockfile.js#L54
  // we could give a better failure message when server tries to compile a file
  // otherwise he'll get a 500 without much more info to debug
  // we use two lock because the local lock is very fast, it's a sort of perf improvement

};

const serveCompiledFile = async ({
  // cancellatioToken,
  logger,
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  projectFileRequestedCallback = () => {},
  request,
  compile,
  writeOnFilesystem,
  useFilesystemAsCache,
  compileCacheStrategy = "etag",
  serverCompileCacheHitTracking = false,
  serverCompileCacheInterProcessLocking = false
}) => {
  if (writeOnFilesystem && compileCacheStrategy !== "etag" && compileCacheStrategy !== "mtime") {
    throw new Error(`compileCacheStrategy must be etag or mtime , got ${compileCacheStrategy}`);
  }

  const cacheWithETag = writeOnFilesystem && compileCacheStrategy === "etag";
  const {
    headers = {}
  } = request;
  let ifEtagMatch;

  if (cacheWithETag) {
    if ("if-none-match" in headers) {
      ifEtagMatch = headers["if-none-match"];
    }
  }

  const cacheWithMtime = writeOnFilesystem && compileCacheStrategy === "mtime";
  let ifModifiedSinceDate;

  if (cacheWithMtime) {
    const ifModifiedSince = headers["if-modified-since"];

    try {
      ifModifiedSinceDate = new Date(ifModifiedSince);
    } catch (e) {
      return {
        status: 400,
        statusText: "if-modified-since header is not a valid date"
      };
    }
  }

  try {
    const {
      meta,
      compileResult,
      compileResultStatus
    } = await getOrGenerateCompiledFile({
      logger,
      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,
      ifEtagMatch,
      ifModifiedSinceDate,
      writeOnFilesystem,
      useFilesystemAsCache,
      cacheHitTracking: serverCompileCacheHitTracking,
      cacheInterProcessLocking: serverCompileCacheInterProcessLocking,
      compile
    });
    projectFileRequestedCallback({
      relativeUrl: urlToRelativeUrl(originalFileUrl, projectDirectoryUrl),
      request
    });
    compileResult.sources.forEach(source => {
      const sourceFileUrl = resolveUrl$1(source, `${compiledFileUrl}__asset__/`);
      projectFileRequestedCallback({
        relativeUrl: urlToRelativeUrl(sourceFileUrl, projectDirectoryUrl),
        request
      });
    });
    const {
      contentType,
      compiledSource
    } = compileResult;

    if (cacheWithETag) {
      if (ifEtagMatch && compileResultStatus === "cached") {
        return {
          status: 304
        };
      }

      return {
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(compiledSource),
          "content-type": contentType,
          eTag: bufferToEtag$1(Buffer.from(compiledSource))
        },
        body: compiledSource
      };
    }

    if (cacheWithMtime) {
      if (ifModifiedSinceDate && compileResultStatus === "cached") {
        return {
          status: 304
        };
      }

      return {
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(compiledSource),
          "content-type": contentType,
          "last-modified": new Date(meta.lastModifiedMs).toUTCString()
        },
        body: compiledSource
      };
    }

    return {
      status: 200,
      headers: {
        "content-length": Buffer.byteLength(compiledSource),
        "content-type": contentType,
        "cache-control": "no-store"
      },
      body: compiledSource
    };
  } catch (error) {
    if (error && error.code === "PARSE_ERROR") {
      const relativeUrl = urlToRelativeUrl(pathToFileUrl(error.data.filename), projectDirectoryUrl);
      projectFileRequestedCallback({
        relativeUrl,
        request
      }); // on the correspondig file

      const json = JSON.stringify(error.data);
      return {
        status: 500,
        statusText: "parse error",
        headers: {
          "cache-control": "no-store",
          "content-length": Buffer.byteLength(json),
          "content-type": "application/json"
        },
        body: json
      };
    }

    if (error && error.statusText === "Unexpected directory operation") {
      return {
        status: 403
      };
    }

    return convertFileSystemErrorToResponseProperties(error);
  }
};

const fetch = nodeRequire("node-fetch");

const AbortController = nodeRequire("abort-controller"); // ideally we should only pass this to the fetch below


https.globalAgent.options.rejectUnauthorized = false;
const fetchUrl = async (url, {
  cancellationToken
} = {}) => {
  // this code allow you to have http/https dependency for convenience
  // but maybe we should warn about this.
  // it could also be vastly improved using a basic in memory cache
  if (url.startsWith("http://")) {
    const response = await fetchUsingHttp(url, {
      cancellationToken
    });
    return response;
  }

  if (url.startsWith("https://")) {
    const response = await fetchUsingHttp(url, {
      cancellationToken
    });
    return response;
  }

  if (url.startsWith("file:///")) {
    try {
      const path = fileUrlToPath(url);
      const code = await createOperation({
        cancellationToken,
        start: () => readFileContent(path)
      });
      return {
        url,
        status: 200,
        body: code,
        headers: {
          "content-type": urlToContentType(url)
        }
      };
    } catch (e) {
      if (e.code === "ENOENT") {
        return {
          url,
          status: 404,
          body: e.stack
        };
      }

      return {
        url,
        status: 500,
        body: e.stack
      };
    }
  }

  throw new Error(`unsupported url: ${url}`);
};

const fetchUsingHttp = async (url, {
  cancellationToken,
  ...rest
} = {}) => {
  if (cancellationToken) {
    // a cancelled fetch will never resolve, while cancellation api
    // expect to get a rejected promise.
    // createOperation ensure we'll get a promise rejected with a cancelError
    const response = await createOperation({
      cancellationToken,
      start: () => fetch(url, {
        signal: cancellationTokenToAbortSignal(cancellationToken),
        ...rest
      })
    });
    return normalizeResponse(response);
  }

  const response = await fetch(url, rest);
  return normalizeResponse(response);
};

const normalizeResponse = async response => {
  const text = await response.text();
  return {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: responseToHeaderMap(response),
    body: text
  };
}; // https://github.com/bitinn/node-fetch#request-cancellation-with-abortsignal


const cancellationTokenToAbortSignal = cancellationToken => {
  const abortController = new AbortController();
  cancellationToken.register(reason => {
    abortController.abort(reason);
  });
  return abortController.signal;
};

const responseToHeaderMap = response => {
  const headerMap = {};
  response.headers.forEach((value, name) => {
    headerMap[name] = value;
  });
  return headerMap;
};

const validateResponseStatusIsOk = ({
  status,
  url
}) => {
  if (responseStatusIsOk(status)) {
    return {
      valid: true
    };
  }

  return {
    valid: false,
    message: `unexpected response status.
--- response status ---
${status}
--- expected status ---
200 to 299
--- url ---
${url}`
  };
};

const responseStatusIsOk = responseStatus => responseStatus >= 200 && responseStatus < 300;

const fetchSourcemap = async ({
  cancellationToken,
  logger,
  moduleUrl,
  moduleContent
}) => {
  const sourcemapParsingResult = parseSourceMappingURL(moduleContent);

  if (!sourcemapParsingResult) {
    return null;
  }

  if (sourcemapParsingResult.sourcemapString) {
    return generateSourcemapFromString(sourcemapParsingResult.sourcemapString, {
      sourcemapUrl: moduleUrl,
      moduleUrl,
      logger
    });
  }

  const sourcemapUrl = resolveUrl$1(sourcemapParsingResult.sourcemapURL, moduleUrl);
  const sourcemapResponse = await fetchUrl(sourcemapUrl, {
    cancellationToken
  });
  const okValidation = validateResponseStatusIsOk(sourcemapResponse);

  if (!okValidation.valid) {
    logger.warn(`unexpected response for sourcemap file:
${okValidation.message}`);
    return null;
  } // in theory we should also check response content-type
  // not really important


  return generateSourcemapFromString(sourcemapResponse.body, {
    logger,
    sourcemapUrl,
    moduleUrl
  });
};

const generateSourcemapFromString = async (sourcemapString, {
  logger,
  sourcemapUrl,
  moduleUrl
}) => {
  const map = parseSourcemapString(sourcemapString, {
    logger,
    sourcemapUrl,
    moduleUrl
  });

  if (!map) {
    return null;
  }

  return map;
};

const parseSourcemapString = (sourcemapString, {
  logger,
  sourcemapUrl,
  moduleUrl
}) => {
  try {
    return JSON.parse(sourcemapString);
  } catch (e) {
    if (e.name === "SyntaxError") {
      if (sourcemapUrl === moduleUrl) {
        logger.error(`syntax error while parsing inlined sourcemap.
--- syntax error stack ---
${e.stack}
--- module url ---
${moduleUrl}`);
      } else {
        logger.error(`syntax error while parsing remote sourcemap.
--- syntax error stack ---
${e.stack}
--- sourcemap url ---
${sourcemapUrl}
--- module url ---
${moduleUrl}`);
      }

      return null;
    }

    throw e;
  }
};

const {
  minify: minifyCode
} = nodeRequire("terser");

const createJsenvRollupPlugin = async ({
  cancellationToken,
  logger,
  projectDirectoryUrl,
  entryPointMap,
  bundleDirectoryUrl,
  compileDirectoryRelativeUrl,
  compileServerOrigin,
  compileServerImportMap,
  importDefaultExtension,
  babelPluginMap,
  format,
  minify,
  detectAndTransformIfNeededAsyncInsertedByRollup = format === "global"
}) => {
  const moduleContentMap = {};
  const redirectionMap = {};
  const compileDirectoryRemoteUrl = resolveDirectoryUrl(compileDirectoryRelativeUrl, compileServerOrigin);
  const chunkId = `${Object.keys(entryPointMap)[0]}.js`;
  const importMap = normalizeImportMap(compileServerImportMap, compileDirectoryRemoteUrl);
  const jsenvRollupPlugin = {
    name: "jsenv",
    resolveId: (specifier, importer = compileDirectoryRemoteUrl) => {
      if (!hasScheme$2(importer)) {
        importer = pathToFileUrl(importer);
      }

      const importUrl = resolveImport({
        specifier,
        importer,
        importMap,
        defaultExtension: importDefaultExtension
      }); // const rollupId = urlToRollupId(importUrl, { projectDirectoryUrl, compileServerOrigin })

      logger.debug(`${specifier} resolved to ${importUrl}`);
      return importUrl;
    },
    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {
    // },
    load: async url => {
      logger.debug(`loads ${url}`);
      const {
        responseUrl,
        contentRaw,
        content,
        map
      } = await loadModule(url);
      saveModuleContent(responseUrl, {
        content,
        contentRaw
      }); // handle redirection

      if (responseUrl !== url) {
        saveModuleContent(url, {
          content,
          contentRaw
        });
        redirectionMap[url] = responseUrl;
      }

      return {
        code: content,
        map
      };
    },
    // resolveImportMeta: () => {}
    // transform should not be required anymore as
    // we will receive
    // transform: async (moduleContent, rollupId) => {}
    outputOptions: options => {
      // rollup does not expects to have http dependency in the mix
      // and relativize then cause they are files behind the scene
      const bundleSourcemapFileUrl = resolveUrl$1(`./${chunkId}.map`, bundleDirectoryUrl);

      const relativePathToUrl = relativePath => {
        const url = resolveUrl$1(relativePath, bundleSourcemapFileUrl); // fix rollup not supporting source being http

        if (url.startsWith(projectDirectoryUrl)) {
          const relativeUrl = urlToRelativeUrl(url, projectDirectoryUrl);

          if (relativeUrl.startsWith("http:/")) {
            const httpUrl = `http://${relativeUrl.slice(`http:/`.length)}`;

            if (httpUrl in redirectionMap) {
              return redirectionMap[httpUrl];
            }

            return httpUrl;
          }

          if (relativeUrl.startsWith("https:/")) {
            const httpsUrl = `https://${relativeUrl.slice(`https:/`.length)}`;

            if (httpsUrl in redirectionMap) {
              return redirectionMap[httpsUrl];
            }

            return httpsUrl;
          }
        }

        return url;
      };

      options.sourcemapPathTransform = relativePath => {
        const url = relativePathToUrl(relativePath);

        if (url.startsWith(compileServerOrigin)) {
          const relativeUrl = url.slice(`${compileServerOrigin}/`.length);
          const fileUrl = `${projectDirectoryUrl}${relativeUrl}`;
          relativePath = fileUrlToRelativePath(fileUrl, bundleSourcemapFileUrl);
          return relativePath;
        }

        if (url.startsWith(projectDirectoryUrl)) {
          return relativePath;
        }

        return url;
      };

      return options;
    },
    renderChunk: source => {
      if (!minify) return null; // https://github.com/terser-js/terser#minify-options

      const minifyOptions = format === "global" ? {
        toplevel: false
      } : {
        toplevel: true
      };
      const result = minifyCode(source, {
        sourceMap: true,
        ...minifyOptions
      });

      if (result.error) {
        throw result.error;
      } else {
        return result;
      }
    },
    writeBundle: async bundle => {
      if (detectAndTransformIfNeededAsyncInsertedByRollup) {
        await transformAsyncInsertedByRollup({
          projectDirectoryUrl,
          bundleDirectoryUrl,
          babelPluginMap,
          bundle
        });
      }

      Object.keys(bundle).forEach(bundleFilename => {
        logger.info(`-> ${bundleDirectoryUrl}${bundleFilename}`);
      });
    }
  };

  const saveModuleContent = (moduleUrl, value) => {
    moduleContentMap[potentialServerUrlToUrl(moduleUrl, {
      compileServerOrigin,
      projectDirectoryUrl
    })] = value;
  };

  const loadModule = async moduleUrl => {
    const {
      responseUrl,
      contentType,
      content
    } = await getModule(moduleUrl);

    if (contentType === "application/javascript") {
      const map = await fetchSourcemap({
        cancellationToken,
        logger,
        moduleUrl,
        moduleContent: content
      });
      return {
        responseUrl,
        contentRaw: content,
        content,
        map
      };
    }

    if (contentType === "application/json") {
      // we could minify json too
      // et a propos du map qui pourrait permettre de connaitre la vrai source pour ce fichier
      // genre dire que la source c'est je ne sais quoi
      // a defaut il faudrait
      // pouvoir tenir compte d'une redirection pour update le
      return {
        responseUrl,
        contentRaw: content,
        content: `export default ${content}`
      };
    }

    if (contentType.startsWith("text/")) {
      // we could minify html, svg, css etc too
      return {
        responseUrl,
        contentRaw: content,
        content: `export default ${JSON.stringify(content)}`
      };
    }

    logger.warn(`unexpected content-type for module.
--- content-type ---
${contentType}
--- expected content-types ---
"application/javascript"
"application/json"
"text/*"
--- module url ---
${moduleUrl}`);
    return {
      responseUrl,
      contentRaw: content,
      // fallback to text
      content: `export default ${JSON.stringify(content)}`
    };
  };

  const getModule = async moduleUrl => {
    const response = await fetchUrl(moduleUrl, {
      cancellationToken
    });
    const okValidation = validateResponseStatusIsOk(response);

    if (!okValidation.valid) {
      throw new Error(okValidation.message);
    }

    return {
      responseUrl: response.url,
      contentType: response.headers["content-type"],
      content: response.body
    };
  };

  return {
    jsenvRollupPlugin,
    getExtraInfo: () => {
      return {
        moduleContentMap
      };
    }
  };
}; // const urlToRollupId = (url, { compileServerOrigin, projectDirectoryUrl }) => {
//   if (url.startsWith(`${compileServerOrigin}/`)) {
//     return fileUrlToPath(`${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`)
//   }
//   if (url.startsWith("file://")) {
//     return fileUrlToPath(url)
//   }
//   return url
// }
// const urlToServerUrl = (url, { projectDirectoryUrl, compileServerOrigin }) => {
//   if (url.startsWith(projectDirectoryUrl)) {
//     return `${compileServerOrigin}/${url.slice(projectDirectoryUrl.length)}`
//   }
//   return null
// }

const potentialServerUrlToUrl = (url, {
  compileServerOrigin,
  projectDirectoryUrl
}) => {
  if (url.startsWith(`${compileServerOrigin}/`)) {
    return `${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`;
  }

  return url;
}; // const rollupIdToFileServerUrl = (rollupId, { projectDirectoryUrl, compileServerOrigin }) => {
//   const fileUrl = rollupIdToFileUrl(rollupId)
//   if (!fileUrl) {
//     return null
//   }
//   if (!fileUrl.startsWith(projectDirectoryUrl)) {
//     return null
//   }
//   const fileRelativeUrl = urlToRelativeUrl(fileUrl, projectDirectoryUrl)
//   return `${compileServerOrigin}/${fileRelativeUrl}`
// }


const transformAsyncInsertedByRollup = async ({
  projectDirectoryUrl,
  bundleDirectoryUrl,
  babelPluginMap,
  bundle
}) => {
  const asyncPluginName = findAsyncPluginNameInBabelPluginMap(babelPluginMap);
  if (!asyncPluginName) return; // we have to do this because rollup ads
  // an async wrapper function without transpiling it
  // if your bundle contains a dynamic import

  await Promise.all(Object.keys(bundle).map(async bundleFilename => {
    const bundleInfo = bundle[bundleFilename];
    const {
      code,
      map
    } = await transformJs({
      projectDirectoryUrl,
      code: bundleInfo.code,
      url: pathToFileUrl(bundleFilename),
      map: bundleInfo.map,
      babelPluginMap: {
        [asyncPluginName]: babelPluginMap[asyncPluginName]
      },
      transformModuleIntoSystemFormat: false,
      // already done by rollup
      transformGenerator: false,
      // already done
      transformGlobalThis: false
    });
    const bundleFileUrl = resolveUrl$1(bundleFilename, bundleDirectoryUrl);
    await Promise.all([writeFileContent(fileUrlToPath(bundleFileUrl), writeSourceMappingURL(code, `./${bundleFilename}.map`)), writeFileContent(fileUrlToPath(`${bundleFileUrl}.map`), JSON.stringify(map))]);
  }));
};

// https://github.com/browserify/resolve/blob/a09a2e7f16273970be4639313c83b913daea15d7/lib/core.json#L1
// https://nodejs.org/api/modules.html#modules_module_builtinmodules
// https://stackoverflow.com/a/35825896
// https://github.com/browserify/resolve/blob/master/lib/core.json#L1
const NATIVE_NODE_MODULE_SPECIFIER_ARRAY = ["assert", "async_hooks", "buffer_ieee754", "buffer", "child_process", "cluster", "console", "constants", "crypto", "_debugger", "dgram", "dns", "domain", "events", "freelist", "fs", "fs/promises", "_http_agent", "_http_client", "_http_common", "_http_incoming", "_http_outgoing", "_http_server", "http", "http2", "https", "inspector", "_linklist", "module", "net", "node-inspect/lib/_inspect", "node-inspect/lib/internal/inspect_client", "node-inspect/lib/internal/inspect_repl", "os", "path", "perf_hooks", "process", "punycode", "querystring", "readline", "repl", "smalloc", "_stream_duplex", "_stream_transform", "_stream_wrap", "_stream_passthrough", "_stream_readable", "_stream_writable", "stream", "string_decoder", "sys", "timers", "_tls_common", "_tls_legacy", "_tls_wrap", "tls", "trace_events", "tty", "url", "util", "v8/tools/arguments", "v8/tools/codemap", "v8/tools/consarray", "v8/tools/csvparser", "v8/tools/logreader", "v8/tools/profile_view", "v8/tools/splaytree", "v8", "vm", "worker_threads", "zlib", // global is special
"global"];
const isBareSpecifierForNativeNodeModule = specifier => {
  return NATIVE_NODE_MODULE_SPECIFIER_ARRAY.includes(specifier);
};

const {
  rollup: rollup$1
} = nodeRequire("rollup");

const generateBundleUsingRollup = async ({
  cancellationToken,
  logger,
  projectDirectoryUrl,
  entryPointMap,
  bundleDirectoryUrl,
  compileDirectoryRelativeUrl,
  compileServerOrigin,
  compileServerImportMap,
  importDefaultExtension,
  node,
  browser,
  babelPluginMap,
  format,
  formatOutputOptions,
  minify,
  sourcemapExcludeSources,
  writeOnFileSystem
}) => {
  const {
    jsenvRollupPlugin,
    getExtraInfo
  } = await createJsenvRollupPlugin({
    cancellationToken,
    logger,
    projectDirectoryUrl,
    entryPointMap,
    bundleDirectoryUrl,
    compileDirectoryRelativeUrl,
    compileServerOrigin,
    compileServerImportMap,
    importDefaultExtension,
    babelPluginMap,
    format,
    minify
  });
  const rollupBundle = await useRollup({
    cancellationToken,
    logger,
    entryPointMap,
    node,
    browser,
    jsenvRollupPlugin,
    format,
    formatOutputOptions,
    bundleDirectoryUrl,
    sourcemapExcludeSources,
    writeOnFileSystem
  });
  return {
    rollupBundle,
    ...getExtraInfo()
  };
};

const useRollup = async ({
  cancellationToken,
  logger,
  entryPointMap,
  node,
  browser,
  jsenvRollupPlugin,
  format,
  formatOutputOptions,
  bundleDirectoryUrl,
  sourcemapExcludeSources,
  writeOnFileSystem
}) => {
  logger.info(`
parse bundle
--- entry point map ---
${JSON.stringify(entryPointMap, null, "  ")}
`);

  const nativeModulePredicate = specifier => {
    if (node && isBareSpecifierForNativeNodeModule(specifier)) return true; // for now browser have no native module
    // and we don't know how we will handle that

    if (browser) return false;
    return false;
  };

  const rollupBundle = await createOperation({
    cancellationToken,
    start: () => rollup$1({
      // about cache here, we should/could reuse previous rollup call
      // to get the cache from the entryPointMap
      // as shown here: https://rollupjs.org/guide/en#cache
      // it could be passed in arguments to this function
      // however parallelism and having different rollup options per
      // call make it a bit complex
      // cache: null
      // https://rollupjs.org/guide/en#experimentaltoplevelawait
      experimentalTopLevelAwait: true,
      // if we want to ignore some warning
      // please use https://rollupjs.org/guide/en#onwarn
      // to be very clear about what we want to ignore
      onwarn: (warning, warn) => {
        if (warning.code === "THIS_IS_UNDEFINED") return;
        warn(warning);
      },
      input: entryPointMap,
      external: id => nativeModulePredicate(id),
      plugins: [jsenvRollupPlugin]
    })
  });
  const rollupGenerateOptions = {
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    experimentalTopLevelAwait: true,
    // we could put prefConst to true by checking 'transform-block-scoping'
    // presence in babelPluginMap
    preferConst: false,
    // https://rollupjs.org/guide/en#output-dir
    dir: fileUrlToPath(bundleDirectoryUrl),
    // https://rollupjs.org/guide/en#output-format
    format: formatToRollupFormat(format),
    // entryFileNames: `./[name].js`,
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources,
    ...formatOutputOptions
  };
  const rollupOutputArray = await createOperation({
    cancellationToken,
    start: () => {
      if (writeOnFileSystem) {
        logger.info(`write bundle at ${rollupGenerateOptions.dir}`);
        return rollupBundle.write(rollupGenerateOptions);
      }

      logger.info("generate bundle");
      return rollupBundle.generate(rollupGenerateOptions);
    }
  });
  return rollupOutputArray;
};

const formatToRollupFormat = format => {
  if (format === "global") return "iife";
  if (format === "commonjs") return "cjs";
  if (format === "systemjs") return "system";
  throw new Error(`unexpected format, got ${format}`);
};

/*

One thing to keep in mind:
the sourcemap.sourcesContent will contains a json file transformed to js
while sourcesContent will contain the json file raw source because the corresponding
json file etag is used to invalidate the cache

*/
const bundleToCompilationResult = ({
  rollupBundle,
  moduleContentMap
}, {
  projectDirectoryUrl,
  compiledFileUrl,
  sourcemapFileUrl
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(`compiledFileUrl must be a string, got ${compiledFileUrl}`);
  }

  if (typeof sourcemapFileUrl !== "string") {
    throw new TypeError(`sourcemapFileUrl must be a string, got ${sourcemapFileUrl}`);
  }

  const sources = [];
  const sourcesContent = [];

  const trackDependencies = dependencyMap => {
    Object.keys(dependencyMap).forEach(moduleUrl => {
      // do not track dependency outside project
      if (!moduleUrl.startsWith(projectDirectoryUrl)) {
        return;
      }

      const relativePath = fileUrlToRelativePath(moduleUrl, `${compiledFileUrl}__asset__/meta.json`);

      if (!sources.includes(relativePath)) {
        sources.push(relativePath);
        sourcesContent.push(dependencyMap[moduleUrl].contentRaw);
      }
    });
  };

  const assets = [];
  const assetsContent = [];
  const mainChunk = parseRollupChunk(rollupBundle.output[0], {
    moduleContentMap,
    sourcemapFileUrl,
    sourcemapFileRelativeUrlForModule: fileUrlToRelativePath(sourcemapFileUrl, compiledFileUrl)
  }); // mainChunk.sourcemap.file = fileUrlToRelativePath(originalFileUrl, sourcemapFileUrl)

  trackDependencies(mainChunk.dependencyMap);
  assets.push(fileUrlToRelativePath(sourcemapFileUrl, `${compiledFileUrl}__asset__/`));
  assetsContent.push(JSON.stringify(mainChunk.sourcemap, null, "  "));
  rollupBundle.output.slice(1).forEach(rollupChunk => {
    const chunkFileName = rollupChunk.fileName;
    const chunk = parseRollupChunk(rollupChunk, {
      moduleContentMap,
      compiledFileUrl
    });
    trackDependencies(chunk.dependencyMap);
    assets.push(chunkFileName);
    assetsContent.push(chunk.content);
    assets.push(`${rollupChunk.fileName}.map`);
    assetsContent.push(JSON.stringify(chunk.sourcemap, null, "  "));
  });
  return {
    contentType: "application/javascript",
    compiledSource: mainChunk.content,
    sources,
    sourcesContent,
    assets,
    assetsContent
  };
};

const parseRollupChunk = (rollupChunk, {
  moduleContentMap,
  sourcemapFileUrl,
  sourcemapFileRelativeUrlForModule = `./${rollupChunk.fileName}.map`
}) => {
  const dependencyMap = {};
  const mainModuleSourcemap = rollupChunk.map;
  mainModuleSourcemap.sources.forEach((source, index) => {
    const moduleUrl = resolveUrl$1(source, sourcemapFileUrl);
    dependencyMap[moduleUrl] = getModuleContent({
      moduleContentMap,
      mainModuleSourcemap,
      moduleUrl,
      moduleIndex: index
    });
  });
  const sourcemap = rollupChunk.map;
  const content = writeOrUpdateSourceMappingURL(rollupChunk.code, sourcemapFileRelativeUrlForModule);
  return {
    dependencyMap,
    content,
    sourcemap
  };
};

const getModuleContent = ({
  moduleContentMap,
  mainModuleSourcemap,
  moduleUrl,
  moduleIndex
}) => {
  if (moduleUrl in moduleContentMap) {
    return moduleContentMap[moduleUrl];
  } // try to read it from mainModuleSourcemap


  const sourcesContent = mainModuleSourcemap.sourcesContent || [];

  if (moduleIndex in sourcesContent) {
    const contentFromRollupSourcemap = sourcesContent[moduleIndex];
    return {
      content: contentFromRollupSourcemap,
      contentRaw: contentFromRollupSourcemap
    };
  } // try to get it from filesystem


  if (moduleUrl.startsWith("file:///")) {
    const moduleFilePath = fileUrlToPath(moduleUrl); // this could be async but it's ok for now
    // making it async could be harder than it seems
    // because sourcesContent must be in sync with sources

    try {
      const moduleFileBuffer = fs.readFileSync(moduleFilePath);
      const moduleFileString = String(moduleFileBuffer);
      return {
        content: moduleFileString,
        contentRaw: moduleFileString
      };
    } catch (e) {
      if (e && e.code === "ENOENT") {
        throw new Error(`module file not found at ${moduleUrl}`);
      }

      throw e;
    }
  } // it's an external ressource like http, throw


  throw new Error(`cannot fetch module content from ${moduleUrl}`);
};

const serveBundle = async ({
  cancellationToken,
  logger,
  jsenvProjectDirectoryUrl,
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  compileServerImportMap,
  importDefaultExtension,
  format,
  formatOutputOptions = {},
  node = format === "commonjs",
  browser = format === "global",
  projectFileRequestedCallback,
  request,
  babelPluginMap
}) => {
  if (typeof jsenvProjectDirectoryUrl !== "string") {
    throw new TypeError(`jsenvProjectDirectoryUrl must be a string, got ${jsenvProjectDirectoryUrl}`);
  }

  const compile = async () => {
    const originalFileRelativeUrl = urlToRelativeUrl(originalFileUrl, projectDirectoryUrl);
    const entryExtname = path.extname(originalFileRelativeUrl);
    const entryBasename = path.basename(originalFileRelativeUrl, entryExtname);
    const entryName = entryBasename;
    const entryPointMap = {
      [entryName]: `./${originalFileRelativeUrl}`
    };
    const compileId = format === "global" ? COMPILE_ID_GLOBAL_BUNDLE_FILES : COMPILE_ID_COMMONJS_BUNDLE_FILES;
    const bundle = await generateBundleUsingRollup({
      cancellationToken,
      logger,
      projectDirectoryUrl,
      entryPointMap,
      // bundleDirectoryUrl is just theorical because of writeOnFileSystem: false
      // but still important to know where the files will be written
      bundleDirectoryUrl: resolveDirectoryUrl("./", compiledFileUrl),
      compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${compileId}/`,
      compileServerOrigin,
      compileServerImportMap,
      importDefaultExtension,
      node,
      browser,
      babelPluginMap,
      format,
      formatOutputOptions,
      writeOnFileSystem: false,
      sourcemapExcludeSources: true
    });
    const sourcemapFileUrl = `${compiledFileUrl}.map`;
    return bundleToCompilationResult(bundle, {
      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,
      sourcemapFileUrl
    });
  };

  return serveCompiledFile({
    logger,
    projectDirectoryUrl,
    originalFileUrl,
    compiledFileUrl,
    writeOnFilesystem: true,
    useFilesystemAsCache: true,
    projectFileRequestedCallback,
    compile,
    request
  });
};

const serveCompiledJs = async ({
  cancellationToken,
  logger,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerImportMap,
  importDefaultExtension,
  transformTopLevelAwait,
  transformModuleIntoSystemFormat,
  babelPluginMap,
  groupMap,
  convertMap,
  request,
  projectFileRequestedCallback,
  useFilesystemAsCache,
  writeOnFilesystem
}) => {
  const {
    origin,
    ressource,
    method,
    headers
  } = request;
  const requestUrl = `${origin}${ressource}`;
  const outDirectoryRemoteUrl = resolveDirectoryUrl(outDirectoryRelativeUrl, origin); // not inside compile directory -> nothing to compile

  if (!requestUrl.startsWith(outDirectoryRemoteUrl)) {
    return null;
  }

  const afterOutDirectory = requestUrl.slice(outDirectoryRemoteUrl.length); // serve files inside /.dist/* directly without compilation
  // this is just to allow some files to be written inside .dist and read directly
  // if asked by the client

  if (!afterOutDirectory.includes("/") || afterOutDirectory[0] === "/") {
    return serveFile(`${projectDirectoryUrl}${ressource.slice(1)}`, {
      method,
      headers
    });
  }

  const parts = afterOutDirectory.split("/");
  const compileId = parts[0]; // no compileId, we don't know what to compile (not supposed so happen)

  if (compileId === "") {
    return null;
  }

  const allowedCompileIds = [...Object.keys(groupMap), COMPILE_ID_GLOBAL_BUNDLE, COMPILE_ID_GLOBAL_BUNDLE_FILES, COMPILE_ID_COMMONJS_BUNDLE, COMPILE_ID_COMMONJS_BUNDLE_FILES];

  if (!allowedCompileIds.includes(compileId)) {
    return {
      status: 400,
      statusText: `compileId must be one of ${allowedCompileIds}, received ${compileId}`
    };
  }

  const remaining = parts.slice(1).join("/"); // nothing after compileId, we don't know what to compile (not supposed to happen)

  if (remaining === "") {
    return null;
  }

  const originalFileRelativeUrl = remaining; // json, css, html etc does not need to be compiled
  // they are redirected to the source location that will be served as file
  // ptet qu'on devrait pas parce que
  // on pourrait vouloir minifier ce résultat (mais bon ça osef disons)
  // par contre on voudrait ptet avoir le bon concept
  // (quon a dans transformResultToCompilationResult)
  // pour tracker la bonne source avec le bon etag
  // sinon on track le export default
  // mais ça ça vient plutot du bundle
  // qui doit gérer content/contentRaw

  const contentType = urlToContentType(requestUrl);

  if (contentType !== "application/javascript") {
    return {
      status: 307,
      headers: {
        location: resolveUrl$1(originalFileRelativeUrl, origin)
      }
    };
  }

  const originalFileUrl = `${projectDirectoryUrl}${originalFileRelativeUrl}`;
  const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`;
  const compileDirectoryUrl = resolveDirectoryUrl(compileDirectoryRelativeUrl, projectDirectoryUrl);
  const compiledFileUrl = resolveUrl$1(originalFileRelativeUrl, compileDirectoryUrl);

  if (compileId === COMPILE_ID_GLOBAL_BUNDLE || compileId === COMPILE_ID_COMMONJS_BUNDLE) {
    return serveBundle({
      cancellationToken,
      logger,
      jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin: request.origin,
      compileServerImportMap,
      importDefaultExtension,
      babelPluginMap,
      projectFileRequestedCallback,
      request,
      format: compileId === COMPILE_ID_GLOBAL_BUNDLE ? "global" : "commonjs"
    });
  }

  return serveCompiledFile({
    cancellationToken,
    logger,
    projectDirectoryUrl,
    originalFileUrl,
    compiledFileUrl,
    writeOnFilesystem,
    useFilesystemAsCache,
    projectFileRequestedCallback,
    request,
    compile: async () => {
      const code = await readFileContent(fileUrlToPath(originalFileUrl));
      let compiledIdForGroupMap;
      let babelPluginMapForGroupMap;

      if (compileId === COMPILE_ID_GLOBAL_BUNDLE_FILES || compileId === COMPILE_ID_COMMONJS_BUNDLE_FILES) {
        compiledIdForGroupMap = getWorstCompileId(groupMap); // we are compiling for rollup, do not transform into systemjs format

        transformModuleIntoSystemFormat = false;
        babelPluginMapForGroupMap = createBabePluginMapForBundle({
          format: compileId === COMPILE_ID_GLOBAL_BUNDLE_FILES ? "global" : "commonjs"
        });
      } else {
        compiledIdForGroupMap = compileId;
        babelPluginMapForGroupMap = {};
      }

      const groupBabelPluginMap = {};
      groupMap[compiledIdForGroupMap].babelPluginRequiredNameArray.forEach(babelPluginRequiredName => {
        if (babelPluginRequiredName in babelPluginMap) {
          groupBabelPluginMap[babelPluginRequiredName] = babelPluginMap[babelPluginRequiredName];
        }
      });
      const transformResult = await transformJs({
        projectDirectoryUrl,
        code,
        url: originalFileUrl,
        urlAfterTransform: compiledFileUrl,
        babelPluginMap: { ...groupBabelPluginMap,
          ...babelPluginMapForGroupMap
        },
        convertMap,
        transformTopLevelAwait,
        transformModuleIntoSystemFormat
      });
      const sourcemapFileUrl = `${compiledFileUrl}.map`;
      return transformResultToCompilationResult(transformResult, {
        projectDirectoryUrl,
        originalFileContent: code,
        originalFileUrl,
        compiledFileUrl,
        sourcemapFileUrl,
        remapMethod: writeOnFilesystem ? "comment" : "inline"
      });
    }
  });
};

const getWorstCompileId = groupMap => {
  if (COMPILE_ID_OTHERWISE in groupMap) {
    return COMPILE_ID_OTHERWISE;
  }

  return Object.keys(groupMap)[Object.keys(groupMap).length - 1];
};

// in the future I may want to put assets in a separate directory like this:
//
// /dist
//   /__assets__
//     index.js.map
//     index.js.cache.json
//       /foo
//        bar.js.map
//        bar.js.cache.json
//   index.js
//   foo/
//     bar.js
//
// so that the dist folder is not polluted with the asset files
// that day pathnameRelativeIsAsset must be this:
// => pathnameRelative.startsWith(`${compileInto}/__assets__/`)
// I don't do it for now because it will impact sourcemap paths
// and sourceMappingURL comment at the bottom of compiled files
// and that's something sensitive
const urlIsAsset = url => {
  // sourcemap are not inside the asset folder because
  // of https://github.com/microsoft/vscode-chrome-debug-core/issues/544
  if (url.endsWith(".map")) return true;
  return url.match(/[^\/]+__asset__\/.+$/);
};

/* eslint-disable import/max-dependencies */
const startCompileServer = async ({
  cancellationToken = createCancellationToken(),
  compileServerLogLevel,
  // js compile options
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl = ".jsenv",
  jsenvDirectoryClean = false,
  outDirectoryName = "out",
  writeOnFilesystem = true,
  useFilesystemAsCache = true,
  importMapFileRelativeUrl = "importMap.json",
  importDefaultExtension,
  env = {},
  babelPluginMap = jsenvBabelPluginMap,
  convertMap = {},
  // options related to the server itself
  protocol = "http",
  privateKey,
  certificate,
  ip = "127.0.0.1",
  port = 0,
  keepProcessAlive = false,
  stopOnPackageVersionChange = false,
  // this callback will be called each time a projectFile was
  // used to respond to a request
  // each time an execution needs a project file this callback
  // will be called.
  projectFileRequestedCallback = undefined,
  projectFilePredicate = () => true,
  // remaining options are complex or private
  compileGroupCount = 1,
  babelCompatMap = jsenvBabelPluginCompatMap,
  browserScoreMap = jsenvBrowserScoreMap,
  nodeVersionScoreMap = jsenvNodeVersionScoreMap,
  platformAlwaysInsidePlatformScoreMap = false
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string. got ${projectDirectoryUrl}`);
  }

  assertImportMapFileRelativeUrl({
    importMapFileRelativeUrl
  });
  const importMapFileUrl = resolveUrl$1(importMapFileRelativeUrl, projectDirectoryUrl);
  assertImportMapFileInsideProject({
    importMapFileUrl,
    projectDirectoryUrl
  }); // importMapFileRelativeUrl normalization

  importMapFileRelativeUrl = urlToRelativeUrl(importMapFileUrl, projectDirectoryUrl);

  if (typeof jsenvDirectoryRelativeUrl !== "string") {
    throw new TypeError(`jsenvDirectoryRelativeUrl must be a string. got ${jsenvDirectoryRelativeUrl}`);
  }

  const jsenvDirectoryUrl = resolveDirectoryUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl); // jsenvDirectoryRelativeUrl normalization

  jsenvDirectoryRelativeUrl = urlToRelativeUrl(jsenvDirectoryUrl, projectDirectoryUrl);

  if (!jsenvDirectoryUrl.startsWith(projectDirectoryUrl)) {
    throw new TypeError(`jsenv directory must be inside project directory
--- jsenv directory url ---
${jsenvDirectoryUrl}
--- project directory url ---
${projectDirectoryUrl}`);
  }

  if (typeof outDirectoryName !== "string") {
    throw new TypeError(`outDirectoryName must be a string. got ${outDirectoryName}`);
  }

  const outDirectoryUrl = resolveDirectoryUrl(outDirectoryName, jsenvDirectoryUrl);
  const outDirectoryRelativeUrl = urlToRelativeUrl(outDirectoryUrl, projectDirectoryUrl);
  const logger = createLogger({
    logLevel: compileServerLogLevel
  });
  const groupMap = generateGroupMap({
    babelPluginMap,
    babelCompatMap,
    platformScoreMap: { ...browserScoreMap,
      node: nodeVersionScoreMap
    },
    groupCount: compileGroupCount,
    platformAlwaysInsidePlatformScoreMap
  });
  const outDirectoryMeta = {
    babelPluginMap,
    convertMap,
    groupMap
  };

  if (jsenvDirectoryClean) {
    logger.info(`clean jsenv directory at ${jsenvDirectoryUrl}`);
    await removeDirectory(fileUrlToPath(jsenvDirectoryUrl));
  }

  if (useFilesystemAsCache) {
    await cleanOutDirectoryIfObsolete({
      logger,
      outDirectoryUrl,
      outDirectoryMeta
    });
  }

  const packageFileUrl = resolveUrl$1("./package.json", jsenvCoreDirectoryUrl);
  const packageFilePath = fileUrlToPath(packageFileUrl);
  const packageVersion = readPackage(packageFilePath).version;

  if (projectFileRequestedCallback) {
    if (typeof projectFileRequestedCallback !== "function") {
      throw new TypeError(`projectFileRequestedCallback must be a function, got ${projectFileRequestedCallback}`);
    }

    const originalProjectFileRequestedCallback = projectFileRequestedCallback;

    projectFileRequestedCallback = ({
      relativeUrl,
      ...rest
    }) => {
      // I doubt an asset like .js.map will change
      // in theory a compilation asset should not change
      // if the source file did not change
      // so we can avoid watching compilation asset
      if (urlIsAsset(`${projectDirectoryUrl}${relativeUrl}`)) {
        return;
      }

      if (projectFilePredicate(relativeUrl)) {
        originalProjectFileRequestedCallback({
          relativeUrl,
          ...rest
        });
      }
    };
  } else {
    projectFileRequestedCallback = () => {};
  }

  const [compileServer, importMapForCompileServer] = await Promise.all([startServer({
    cancellationToken,
    logLevel: compileServerLogLevel,
    protocol,
    privateKey,
    certificate,
    ip,
    port,
    sendInternalErrorStack: true,
    requestToResponse: request => {
      return firstService(() => {
        const {
          origin,
          ressource,
          method,
          headers
        } = request;
        const requestUrl = `${origin}${ressource}`; // serve asset files directly

        if (urlIsAsset(requestUrl)) {
          const fileUrl = resolveUrl$1(ressource.slice(1), projectDirectoryUrl);
          return serveFile(fileUrl, {
            method,
            headers
          });
        }

        return null;
      }, () => {
        return serveCompiledJs({
          cancellationToken,
          logger,
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          compileServerImportMap: importMapForCompileServer,
          importDefaultExtension,
          transformTopLevelAwait,
          transformModuleIntoSystemFormat,
          babelPluginMap,
          groupMap,
          convertMap,
          request,
          projectFileRequestedCallback,
          useFilesystemAsCache,
          writeOnFilesystem
        });
      }, () => {
        return serveProjectFiles({
          projectDirectoryUrl,
          request,
          projectFileRequestedCallback
        });
      });
    },
    accessControlAllowRequestOrigin: true,
    accessControlAllowRequestMethod: true,
    accessControlAllowRequestHeaders: true,
    accessControlAllowedRequestHeaders: [...jsenvAccessControlAllowedHeaders, "x-jsenv-execution-id"],
    accessControlAllowCredentials: true,
    keepProcessAlive
  }), generateImportMapForCompileServer({
    logger,
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    importMapFileRelativeUrl
  })]);
  env = { ...env,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension
  };

  const importMapToString = () => JSON.stringify(importMapForCompileServer, null, "  ");

  const groupMapToString = () => JSON.stringify(groupMap, null, "  ");

  const envToString = () => Object.keys(env).map(key => `
export const ${key} = ${JSON.stringify(env[key])}
`).join("");

  const jsenvImportMapFilePath = fileUrlToPath(resolveUrl$1("./importMap.json", jsenvDirectoryUrl));
  const jsenvGroupMapFilePath = fileUrlToPath(resolveUrl$1("./groupMap.json", jsenvDirectoryUrl));
  const jsenvEnvFilePath = fileUrlToPath(resolveUrl$1("./env.js", jsenvDirectoryUrl));
  await Promise.all([writeFileContent(jsenvImportMapFilePath, importMapToString()), writeFileContent(jsenvGroupMapFilePath, groupMapToString()), writeFileContent(jsenvEnvFilePath, envToString())]);

  if (!writeOnFilesystem) {
    compileServer.stoppedPromise.then(() => {
      removeFile(jsenvImportMapFilePath);
      removeFile(jsenvGroupMapFilePath);
      removeFile(jsenvEnvFilePath);
    });
  }

  if (stopOnPackageVersionChange) {
    const checkPackageVersion = () => {
      let packageObject;

      try {
        packageObject = readPackage(packageFilePath);
      } catch (e) {
        // package json deleted ? not a problem
        // let's wait for it to show back
        if (e.code === "ENOENT") return; // package.json malformed ? not a problem
        // let's wait for use to fix it or filesystem to finish writing the file

        if (e.name === "SyntaxError") return;
        throw e;
      }

      if (packageVersion !== packageObject.version) {
        compileServer.stop(STOP_REASON_PACKAGE_VERSION_CHANGED);
      }
    };

    const unregister = registerFileLifecycle(packageFilePath, {
      added: checkPackageVersion,
      updated: checkPackageVersion,
      keepProcessAlive: false
    });
    compileServer.stoppedPromise.then(() => {
      unregister();
    }, () => {});
  }

  return {
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    ...compileServer,
    compileServerImportMap: importMapForCompileServer,
    compileServerGroupMap: groupMap
  };
};

const readPackage = packagePath => {
  const buffer = fs.readFileSync(packagePath);
  const string = String(buffer);
  const packageObject = JSON.parse(string);
  return packageObject;
};

const STOP_REASON_PACKAGE_VERSION_CHANGED = {
  toString: () => `package version changed`
};

const serveProjectFiles = async ({
  projectDirectoryUrl,
  request,
  projectFileRequestedCallback
}) => {
  const {
    ressource,
    method,
    headers
  } = request;
  const relativeUrl = ressource.slice(1);
  projectFileRequestedCallback({
    relativeUrl,
    request
  });
  const fileUrl = resolveUrl$1(relativeUrl, projectDirectoryUrl);
  const filePath = fileUrlToPath(fileUrl);
  const responsePromise = serveFile(filePath, {
    method,
    headers
  });
  return responsePromise;
};
/**
 * generateImportMapForCompileServer allows the following:
 *
 * import importMap from '/.jsenv/importMap.json'
 *
 * returns jsenv internal importMap and
 *
 * import importMap from '/importMap.json'
 *
 * returns the project importMap.
 * Note that if importMap file does not exists an empty object is returned.
 * Note that if project uses a custom importMapFileRelativeUrl jsenv internal import map
 * remaps '/importMap.json' to the real importMap
 *
 * This pattern exists so that jsenv can resolve some dynamically injected import such as
 *
 * @jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js
 */


const generateImportMapForCompileServer = async ({
  logger,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  importMapFileRelativeUrl
}) => {
  const importMapForJsenvCore = await generateImportMapForPackage({
    logger,
    projectDirectoryPath: fileUrlToPath(jsenvCoreDirectoryUrl),
    rootProjectDirectoryPath: fileUrlToPath(projectDirectoryUrl)
  });
  const importMapInternal = {
    imports: { ...(jsenvDirectoryRelativeUrl === ".jsenv/" ? {} : {
        "/.jsenv/": `./${jsenvDirectoryRelativeUrl}`
      }),
      // in case importMapFileRelativeUrl is not the default
      // redirect /importMap.json to the proper location
      // well fuck it won't be compiled to something
      // with this approach
      ...(importMapFileRelativeUrl === "importMap.json" ? {} : {
        // but it means importMap.json is not
        // gonna hit compile server
        "/importMap.json": `./${importMapFileRelativeUrl}`
      })
    }
  };
  const importMapForProject = await readProjectImportMap({
    logger,
    projectDirectoryUrl,
    jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
    importMapFileRelativeUrl
  });
  const importMap = [importMapForJsenvCore, importMapInternal, importMapForProject].reduce((previous, current) => composeTwoImportMaps(previous, current), {});
  return importMap;
};

const cleanOutDirectoryIfObsolete = async ({
  logger,
  outDirectoryUrl,
  outDirectoryMeta
}) => {
  const jsenvCorePackageFileUrl = resolveUrl$1("./package.json", jsenvCoreDirectoryUrl);
  const jsenvCorePackageFilePath = fileUrlToPath(jsenvCorePackageFileUrl);
  const jsenvCorePackageVersion = readPackage(jsenvCorePackageFilePath).version;
  outDirectoryMeta = { ...outDirectoryMeta,
    jsenvCorePackageVersion
  };
  const metaFileUrl = resolveUrl$1("./meta.json", outDirectoryUrl);
  const metaFilePath = fileUrlToPath(metaFileUrl);
  const compileDirectoryPath = fileUrlToPath(outDirectoryUrl);
  let previousOutDirectoryMeta;

  try {
    const source = await readFileContent(metaFilePath);
    previousOutDirectoryMeta = JSON.parse(source);
  } catch (e) {
    if (e && e.code === "ENOENT") {
      previousOutDirectoryMeta = null;
    } else {
      throw e;
    }
  }

  if (previousOutDirectoryMeta !== null && JSON.stringify(previousOutDirectoryMeta) !== JSON.stringify(outDirectoryMeta)) {
    logger.info(`clean out directory at ${compileDirectoryPath}`);
    await removeDirectory(compileDirectoryPath);
  }

  await writeFileContent(metaFilePath, JSON.stringify(outDirectoryMeta, null, "  "));
};

const {
  createFileCoverage
} = nodeRequire("istanbul-lib-coverage"); // https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43


const composeCoverageMap = (...coverageMaps) => {
  const finalCoverageMap = {};
  coverageMaps.forEach(coverageMap => {
    Object.keys(coverageMap).forEach(filename => {
      const coverage = coverageMap[filename];
      finalCoverageMap[filename] = filename in finalCoverageMap ? merge(finalCoverageMap[filename], coverage) : coverage;
    });
  });
  return finalCoverageMap;
};

const merge = (coverageA, coverageB) => {
  const fileCoverage = createFileCoverage(coverageA);
  fileCoverage.merge(coverageB);
  return fileCoverage.toJSON();
};

const TIMING_BEFORE_EXECUTION = "before-execution";
const TIMING_DURING_EXECUTION = "during-execution";
const TIMING_AFTER_EXECUTION = "after-execution";
const launchAndExecute = async ({
  cancellationToken = createCancellationToken(),
  launchLogger,
  executeLogger,
  fileRelativeUrl,
  launch,
  // stopPlatformAfterExecute false by default because you want to keep browser alive
  // or nodejs process
  // however unit test will pass true because they want to move on
  stopPlatformAfterExecute = false,
  // when launchPlatform returns { disconnected, stop, stopForce }
  // the launched platform have that amount of ms for disconnected to resolve
  // before we call stopForce
  allocatedMsBeforeForceStop = 4000,
  platformConsoleCallback = () => {},
  platformStartedCallback = () => {},
  platformStoppedCallback = () => {},
  platformErrorCallback = () => {},
  platformDisconnectCallback = () => {},
  measureDuration = false,
  mirrorConsole = false,
  captureConsole = false,
  // rename collectConsole ?
  collectPlatformName = false,
  collectPlatformVersion = false,
  inheritCoverage = false,
  collectCoverage = false,
  ...rest
} = {}) => {
  if (typeof fileRelativeUrl !== "string") {
    throw new TypeError(`fileRelativeUrl must be a string, got ${fileRelativeUrl}`);
  }

  if (typeof launch !== "function") {
    throw new TypeError(`launch launch must be a function, got ${launch}`);
  }

  let executionResultTransformer = executionResult => executionResult;

  if (measureDuration) {
    const startMs = Date.now();
    executionResultTransformer = composeTransformer(executionResultTransformer, executionResult => {
      const endMs = Date.now();
      executionResult.startMs = startMs;
      executionResult.endMs = endMs;
      return executionResult;
    });
  }

  if (mirrorConsole) {
    platformConsoleCallback = composeCallback(platformConsoleCallback, ({
      type,
      text
    }) => {
      if (type === "error") {
        process.stderr.write(text);
      } else {
        process.stdout.write(text);
      }
    });
  }

  if (captureConsole) {
    const consoleCalls = [];
    platformConsoleCallback = composeCallback(platformConsoleCallback, ({
      type,
      text
    }) => {
      consoleCalls.push({
        type,
        text
      });
    });
    executionResultTransformer = composeTransformer(executionResultTransformer, executionResult => {
      executionResult.consoleCalls = consoleCalls;
      return executionResult;
    });
  }

  if (collectPlatformName) {
    platformStartedCallback = composeCallback(platformStartedCallback, ({
      name
    }) => {
      executionResultTransformer = composeTransformer(executionResultTransformer, executionResult => {
        executionResult.platformName = name;
        return executionResult;
      });
    });
  }

  if (collectPlatformVersion) {
    platformStartedCallback = composeCallback(platformStartedCallback, ({
      version
    }) => {
      executionResultTransformer = composeTransformer(executionResultTransformer, executionResult => {
        executionResult.platformVersion = version;
        return executionResult;
      });
    });
  }

  if (inheritCoverage) {
    const savedCollectCoverage = collectCoverage;
    collectCoverage = true;
    executionResultTransformer = composeTransformer(executionResultTransformer, executionResult => {
      const {
        coverageMap,
        ...rest
      } = executionResult; // ensure the coverage of the launched stuff
      // is accounted as coverage for this

      global.__coverage__ = composeCoverageMap(global.__coverage__ || {}, coverageMap || {});
      return savedCollectCoverage ? executionResult : rest;
    });
  }

  const executionResult = await computeRawExecutionResult({
    cancellationToken,
    launchLogger,
    executeLogger,
    fileRelativeUrl,
    launch,
    stopPlatformAfterExecute,
    allocatedMsBeforeForceStop,
    platformConsoleCallback,
    platformErrorCallback,
    platformDisconnectCallback,
    platformStartedCallback,
    platformStoppedCallback,
    collectCoverage,
    ...rest
  });
  return executionResultTransformer(executionResult);
};

const composeCallback = (previousCallback, callback) => {
  return (...args) => {
    previousCallback(...args);
    return callback(...args);
  };
};

const composeTransformer = (previousTransformer, transformer) => {
  return value => {
    const transformedValue = previousTransformer(value);
    return transformer(transformedValue);
  };
};

const computeRawExecutionResult = async ({
  cancellationToken,
  allocatedMs,
  ...rest
}) => {
  const hasAllocatedMs = typeof allocatedMs === "number" && allocatedMs !== Infinity;

  if (!hasAllocatedMs) {
    return computeExecutionResult({
      cancellationToken,
      ...rest
    });
  } // here if allocatedMs is very big
  // setTimeout may be called immediatly
  // in that case we should just throw that hte number is too big


  const TIMEOUT_CANCEL_REASON = "timeout";
  const id = setTimeout(() => {
    timeoutCancellationSource.cancel(TIMEOUT_CANCEL_REASON);
  }, allocatedMs);

  const timeoutCancel = () => clearTimeout(id);

  cancellationToken.register(timeoutCancel);
  const timeoutCancellationSource = createCancellationSource();
  const externalOrTimeoutCancellationToken = composeCancellationToken(cancellationToken, timeoutCancellationSource.token);

  try {
    const executionResult = await computeExecutionResult({
      cancellationToken: externalOrTimeoutCancellationToken,
      ...rest
    });
    timeoutCancel();
    return executionResult;
  } catch (e) {
    if (errorToCancelReason(e) === TIMEOUT_CANCEL_REASON) {
      return createTimedoutExecutionResult();
    }

    throw e;
  }
};

const computeExecutionResult = async ({
  cancellationToken,
  launchLogger,
  executeLogger,
  fileRelativeUrl,
  launch,
  stopPlatformAfterExecute,
  allocatedMsBeforeForceStop,
  platformStartedCallback,
  platformStoppedCallback,
  platformConsoleCallback,
  platformErrorCallback,
  platformDisconnectCallback,
  ...rest
}) => {
  launchLogger.debug(`start a platform to execute a file.`);
  const launchOperation = createStoppableOperation({
    cancellationToken,
    start: async () => {
      const value = await launch({
        cancellationToken,
        logger: launchLogger,
        ...rest
      });
      platformStartedCallback({
        name: value.name,
        version: value.version
      });
      return value;
    },
    stop: async platform => {
      // external code can cancel using cancellationToken at any time.
      // (hotreloading note: we would do that and listen for stoppedCallback before restarting an operation)
      // it is important to keep the code inside this stop function because once cancelled
      // all code after the operation won't execute because it will be rejected with
      // the cancellation error
      let forceStopped = false;

      if (platform.stopForce) {
        const stopPromise = (async () => {
          await platform.stop();
          return false;
        })();

        const stopForcePromise = (async () => {
          await new Promise(async resolve => {
            const timeoutId = setTimeout(resolve, allocatedMsBeforeForceStop);

            try {
              await stopPromise;
            } finally {
              clearTimeout(timeoutId);
            }
          });
          await platform.stopForce();
          return true;
        })();

        forceStopped = await Promise.all([stopPromise, stopForcePromise]);
      } else {
        await platform.stop();
      }

      platformStoppedCallback({
        forced: forceStopped
      });
      launchLogger.debug(`platform stopped.`);
    }
  });
  const {
    name: platformName,
    version: platformVersion,
    options,
    executeFile,
    registerErrorCallback,
    registerConsoleCallback,
    registerDisconnectCallback
  } = await launchOperation;
  launchLogger.debug(`${platformName}@${platformVersion} started.
--- options ---
options: ${JSON.stringify(options, null, "  ")}`);
  registerConsoleCallback(platformConsoleCallback);
  executeLogger.debug(`execute file ${fileRelativeUrl}`);
  const executeOperation = createOperation({
    cancellationToken,
    start: async () => {
      let timing = TIMING_BEFORE_EXECUTION;
      const disconnected = new Promise(resolve => {
        registerDisconnectCallback(() => {
          executeLogger.debug(`platform disconnected.`);
          platformDisconnectCallback({
            timing
          });
          resolve();
        });
      });
      const executed = executeFile(fileRelativeUrl, rest);
      timing = TIMING_DURING_EXECUTION;
      registerErrorCallback(error => {
        if (timing === "after-execution") {
          executeLogger.error(`error after execution
--- error stack ---
${error.stack}`);
        } else {
          executeLogger.error(`error during execution
--- error stack ---
${error.stack}`);
        }

        platformErrorCallback({
          error,
          timing
        });
      });
      const raceResult = await promiseTrackRace([disconnected, executed]);
      timing = TIMING_AFTER_EXECUTION;

      if (raceResult.winner === disconnected) {
        return createDisconnectedExecutionResult();
      }

      if (stopPlatformAfterExecute) {
        launchOperation.stop("stop after execute");
      }

      const executionResult = raceResult.value;
      const {
        status
      } = executionResult;

      if (status === "errored") {
        executeLogger.error(`execution errored.
--- error stack ---
${executionResult.error.stack}`);
        return createErroredExecutionResult(executionResult, rest);
      }

      executeLogger.debug(`execution completed.`);
      return createCompletedExecutionResult(executionResult, rest);
    }
  });
  const executionResult = await executeOperation;
  return executionResult;
};

const createTimedoutExecutionResult = () => {
  return {
    status: "timedout"
  };
};

const createDisconnectedExecutionResult = () => {
  return {
    status: "disconnected"
  };
};

const createErroredExecutionResult = ({
  error,
  coverageMap
}, {
  collectCoverage
}) => {
  return {
    status: "errored",
    error,
    ...(collectCoverage ? {
      coverageMap
    } : {})
  };
};

const createCompletedExecutionResult = ({
  namespace,
  coverageMap
}, {
  collectNamespace,
  collectCoverage
}) => {
  return {
    status: "completed",
    ...(collectNamespace ? {
      namespace: normalizeNamespace(namespace)
    } : {}),
    ...(collectCoverage ? {
      coverageMap
    } : {})
  };
};

const normalizeNamespace = namespace => {
  if (typeof namespace !== "object") return namespace;
  if (namespace instanceof Promise) return namespace;
  const normalized = {}; // remove "__esModule" or Symbol.toStringTag from namespace object

  Object.keys(namespace).forEach(key => {
    normalized[key] = namespace[key];
  });
  return normalized;
};

const promiseTrackRace = promiseArray => {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const visit = index => {
      const promise = promiseArray[index];
      promise.then(value => {
        if (resolved) return;
        resolved = true;
        resolve({
          winner: promise,
          value,
          index
        });
      }, reject);
    };

    let i = 0;

    while (i < promiseArray.length) {
      visit(i++);
    }
  });
};

const execute = async ({
  cancellationToken = createCancellationTokenForProcessSIGINT(),
  logLevel = "off",
  compileServerLogLevel = logLevel,
  launchLogLevel = logLevel,
  executeLogLevel = logLevel,
  projectDirectoryPath,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  fileRelativeUrl,
  babelPluginMap,
  convertMap,
  compileGroupCount = 2,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  launch,
  mirrorConsole = true,
  stopPlatformAfterExecute = true,
  ...rest
}) => {
  const launchLogger = createLogger({
    logLevel: launchLogLevel
  });
  const executeLogger = createLogger({
    logLevel: executeLogLevel
  });
  assertProjectDirectoryPath({
    projectDirectoryPath
  });
  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath);
  await assertProjectDirectoryExists({
    projectDirectoryUrl
  });

  if (typeof fileRelativeUrl !== "string") {
    throw new TypeError(`fileRelativeUrl must be a string, got ${fileRelativeUrl}`);
  }

  fileRelativeUrl = fileRelativeUrl.replace(/\\/g, "/");

  if (typeof launch !== "function") {
    throw new TypeError(`launch must be a function, got ${launch}`);
  }

  return catchAsyncFunctionCancellation(async () => {
    const {
      jsenvDirectoryRelativeUrl: compileServerJsenvDirectoryRelativeUrl,
      outDirectoryRelativeUrl,
      origin: compileServerOrigin
    } = await startCompileServer({
      cancellationToken,
      compileServerLogLevel,
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      importMapFileRelativeUrl,
      importDefaultExtension,
      babelPluginMap,
      convertMap,
      compileGroupCount,
      protocol,
      ip,
      port
    });
    const result = await launchAndExecute({
      cancellationToken,
      launchLogger,
      executeLogger,
      fileRelativeUrl,
      launch: params => launch({
        projectDirectoryUrl,
        jsenvDirectoryRelativeUrl: compileServerJsenvDirectoryRelativeUrl,
        outDirectoryRelativeUrl,
        compileServerOrigin,
        ...params
      }),
      mirrorConsole,
      stopPlatformAfterExecute,
      ...rest
    });

    if (result.status === "errored") {
      throw result.error;
    }

    return result;
  });
};

const {
  programVisitor
} = nodeRequire("istanbul-lib-instrument"); // https://github.com/istanbuljs/babel-plugin-istanbul/blob/321740f7b25d803f881466ea819d870f7ed6a254/src/index.js


const createInstrumentBabelPlugin = ({
  useInlineSourceMaps = false,
  predicate = () => true
} = {}) => {
  return ({
    types
  }) => {
    return {
      visitor: {
        Program: {
          enter(path) {
            const {
              file
            } = this;
            const {
              opts
            } = file;
            const relativeUrl = optionsToRelativeUrl(opts);

            if (!relativeUrl) {
              console.warn("file without relativeUrl", relativeUrl);
              return;
            }

            if (!predicate({
              relativeUrl
            })) return;
            this.__dv__ = null;
            let inputSourceMap;

            if (useInlineSourceMaps) {
              // https://github.com/istanbuljs/babel-plugin-istanbul/commit/a9e15643d249a2985e4387e4308022053b2cd0ad#diff-1fdf421c05c1140f6d71444ea2b27638R65
              inputSourceMap = opts.inputSourceMap || file.inputMap ? file.inputMap.sourcemap : null;
            } else {
              inputSourceMap = opts.inputSourceMap;
            }

            this.__dv__ = programVisitor(types, opts.filenameRelative || opts.filename, {
              coverageVariable: "__coverage__",
              inputSourceMap
            });

            this.__dv__.enter(path);
          },

          exit(path) {
            if (!this.__dv__) {
              return;
            }

            const object = this.__dv__.exit(path); // object got two properties: fileCoverage and sourceMappingURL


            this.file.metadata.coverage = object.fileCoverage;
          }

        }
      }
    };
  };
};

const optionsToRelativeUrl = ({
  filenameRelative
}) => {
  if (filenameRelative) return filenameRelative;
  return "";
};

const pathToDirectoryUrl$3 = path => {
  const directoryUrl = path.startsWith("file://") ? path : String(url$2.pathToFileURL(path));

  if (directoryUrl.endsWith("/")) {
    return directoryUrl;
  }

  return `${directoryUrl}/`;
};
const fileUrlToPath$3 = fileUrl => {
  return url$2.fileURLToPath(fileUrl);
};
const fileUrlToRelativePath$3 = (fileUrl, baseUrl) => {
  if (typeof baseUrl !== "string") {
    throw new TypeError(`baseUrl must be a string, got ${baseUrl}`);
  }

  if (fileUrl.startsWith(baseUrl)) {
    return fileUrl.slice(baseUrl.length);
  }

  return fileUrl;
};

const collectFiles = async ({
  cancellationToken = createCancellationToken$1(),
  directoryPath,
  specifierMetaMap,
  predicate,
  matchingFileOperation = () => null
}) => {
  if (typeof directoryPath !== "string") {
    throw new TypeError(`directoryPath must be a string, got ${directoryPath}`);
  }

  if (typeof predicate !== "function") {
    throw new TypeError(`predicate must be a function, got ${predicate}`);
  }

  if (typeof matchingFileOperation !== "function") {
    throw new TypeError(`matchingFileOperation must be a function, got ${matchingFileOperation}`);
  }

  const rootDirectoryUrl = pathToDirectoryUrl$3(directoryPath);
  const specifierMetaMapNormalized = normalizeSpecifierMetaMap(specifierMetaMap, rootDirectoryUrl);
  const matchingFileResultArray = [];

  const visitDirectory = async (directoryUrl, depth) => {
    const directoryPath = fileUrlToPath$3(directoryUrl);
    const directoryItems = await createOperation$1({
      cancellationToken,
      start: () => readDirectory$1(directoryPath)
    });
    await Promise.all(directoryItems.map(async (directoryItem, index) => {
      const directoryItemUrl = `${directoryUrl}${directoryItem}`;
      const directoryItemPath = fileUrlToPath$3(directoryItemUrl);
      const lstat = await createOperation$1({
        cancellationToken,
        start: () => readLStat(directoryItemPath)
      });

      if (lstat.isDirectory()) {
        const subDirectoryUrl = `${directoryItemUrl}/`;

        if (!urlCanContainsMetaMatching({
          url: subDirectoryUrl,
          specifierMetaMap: specifierMetaMapNormalized,
          predicate
        })) {
          return;
        }

        await visitDirectory(subDirectoryUrl, depth + 1);
        return;
      }

      if (lstat.isFile()) {
        const meta = urlToMeta({
          url: directoryItemUrl,
          specifierMetaMap: specifierMetaMapNormalized
        });
        if (!predicate(meta)) return;
        const relativePath = fileUrlToRelativePath$3(directoryItemUrl, rootDirectoryUrl);
        const operationResult = await createOperation$1({
          cancellationToken,
          start: () => matchingFileOperation({
            cancellationToken,
            relativePath,
            meta,
            lstat
          })
        });
        matchingFileResultArray.push({
          relativePath,
          meta,
          lstat,
          operationResult,
          index,
          depth
        });
        return;
      } // we ignore symlink because entryFolder is recursively traversed
      // so symlinked file will be discovered.
      // Moreover if they lead outside of entryFolder it can become a problem
      // like infinite recursion of whatever.
      // that we could handle using an object of pathname already seen but it will be useless
      // because entryFolder is recursively traversed

    }));
  };

  await visitDirectory(rootDirectoryUrl, 0); // When we operate on thoose files later it feels more natural
  // to perform operation in the same order they appear in the filesystem.
  // It also allow to get a predictable return value.
  // For that reason we sort matchingFileResultArray

  return sortMatchingFileResultArray(matchingFileResultArray);
};

const readDirectory$1 = pathname => new Promise((resolve, reject) => {
  fs.readdir(pathname, (error, names) => {
    if (error) {
      reject(error);
    } else {
      resolve(names);
    }
  });
});

const readLStat = pathname => new Promise((resolve, reject) => {
  fs.lstat(pathname, (error, stat) => {
    if (error) {
      reject(error);
    } else {
      resolve(stat);
    }
  });
});

const sortMatchingFileResultArray = matchingFileResultArray => matchingFileResultArray.sort(compareMatchingFileResult);

const compareMatchingFileResult = (leftMatchingFileResult, rightMatchingFileResult) => {
  const leftDepth = leftMatchingFileResult.depth;
  const rightDepth = rightMatchingFileResult.depth;

  if (leftDepth !== rightDepth) {
    return rightDepth - leftDepth;
  }

  return leftMatchingFileResult.index - rightMatchingFileResult.index;
};

const generateFileExecutionSteps = ({
  fileRelativeUrl,
  filePlan
}) => {
  const fileExecutionSteps = [];
  Object.keys(filePlan).forEach(name => {
    const stepConfig = filePlan[name];

    if (stepConfig === null || stepConfig === undefined) {
      return;
    }

    if (typeof stepConfig !== "object") {
      throw new TypeError(`found unexpected value in plan, they must be object.
--- file relative path ---
${fileRelativeUrl}
--- name ---
${name}
--- value ---
${stepConfig}`);
    }

    fileExecutionSteps.push({
      name,
      fileRelativeUrl,
      ...stepConfig
    });
  });
  return fileExecutionSteps;
};

const generateExecutionSteps = async (plan, {
  cancellationToken,
  projectDirectoryUrl
}) => {
  const specifierMetaMap = metaMapToSpecifierMetaMap({
    filePlan: plan
  });
  const fileResultArray = await collectFiles({
    cancellationToken,
    directoryPath: pathToFileUrl(projectDirectoryUrl),
    specifierMetaMap,
    predicate: ({
      filePlan
    }) => filePlan
  });
  const executionSteps = [];
  fileResultArray.forEach(({
    relativePath,
    meta
  }) => {
    const fileExecutionSteps = generateFileExecutionSteps({
      fileRelativeUrl: relativePath,
      filePlan: meta.filePlan
    });
    executionSteps.push(...fileExecutionSteps);
  });
  return executionSteps;
};

const fetch$1 = nodeRequire("node-fetch");

const startCompileServerForExecutingPlan = async ({
  // false because don't know if user is going
  // to use both node and browser
  browserPlatformAnticipatedGeneration = false,
  nodePlatformAnticipatedGeneration = false,
  ...rest
}) => {
  const compileServer = await startCompileServer(rest);
  const promises = [];

  if (browserPlatformAnticipatedGeneration) {
    promises.push(fetch$1(`${compileServer.origin}/${compileServer.outDirectoryRelativeUrl}otherwise-global-bundle/src/browserPlatform.js`));
  }

  if (nodePlatformAnticipatedGeneration) {
    promises.push(fetch$1(`${compileServer.origin}/${compileServer.outDirectoryRelativeUrl}otherwise-commonjs-bundle/src/nodePlatform.js`));
  }

  await Promise.all(promises);
  return compileServer;
};

const {
  createFileCoverage: createFileCoverage$1
} = nodeRequire("istanbul-lib-coverage");

const createEmptyCoverage = relativeUrl => createFileCoverage$1(relativeUrl).toJSON();

const syntaxDynamicImport$1 = nodeRequire("@babel/plugin-syntax-dynamic-import");

const syntaxImportMeta$1 = nodeRequire("@babel/plugin-syntax-import-meta");

const {
  transformAsync: transformAsync$1
} = nodeRequire("@babel/core");

const relativeUrlToEmptyCoverage = async (relativeUrl, {
  cancellationToken,
  projectDirectoryUrl,
  babelPluginMap
}) => {
  const fileUrl = resolveUrl$1(relativeUrl, projectDirectoryUrl);
  const filePath = fileUrlToPath(fileUrl);
  const source = await createOperation({
    cancellationToken,
    start: () => readFileContent(filePath)
  }); // we must compile to get the coverage object
  // without evaluating the file because it would increment coverage
  // and execute code that can be doing anything

  try {
    const {
      metadata
    } = await createOperation({
      cancellationToken,
      start: () => transformAsync$1(source, {
        filename: filePath,
        filenameRelative: relativeUrl,
        configFile: false,
        babelrc: false,
        parserOpts: {
          allowAwaitOutsideFunction: true
        },
        plugins: [syntaxDynamicImport$1, syntaxImportMeta$1, ...Object.keys(babelPluginMap).map(babelPluginName => babelPluginMap[babelPluginName]), createInstrumentBabelPlugin({
          predicate: () => true
        })]
      })
    });
    const {
      coverage
    } = metadata;

    if (!coverage) {
      throw new Error(`missing coverage for file`);
    } // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229


    Object.keys(coverage.s).forEach(function (key) {
      coverage.s[key] = 0;
    });
    return coverage;
  } catch (e) {
    if (e && e.code === "BABEL_PARSE_ERROR") {
      // return an empty coverage for that file when
      // it contains a syntax error
      return createEmptyCoverage(relativeUrl);
    }

    throw e;
  }
};

const reportToCoverageMap = async (report, {
  cancellationToken,
  projectDirectoryUrl,
  babelPluginMap,
  coverageConfig,
  coverageIncludeMissing
}) => {
  const coverageMapForReport = executionReportToCoverageMap(report);

  if (!coverageIncludeMissing) {
    return coverageMapForReport;
  }

  const relativeFileUrlToCoverArray = await listRelativeFileUrlToCover({
    cancellationToken,
    projectDirectoryUrl,
    coverageConfig
  });
  const relativeFileUrlMissingCoverageArray = relativeFileUrlToCoverArray.filter(relativeFileUrlToCover => relativeFileUrlToCover in coverageMapForReport === false);
  const coverageMapForMissedFiles = {};
  await Promise.all(relativeFileUrlMissingCoverageArray.map(async relativeFileUrlMissingCoverage => {
    const emptyCoverage = await relativeUrlToEmptyCoverage(relativeFileUrlMissingCoverage, {
      cancellationToken,
      projectDirectoryUrl,
      babelPluginMap
    });
    coverageMapForMissedFiles[relativeFileUrlMissingCoverage] = emptyCoverage;
    return emptyCoverage;
  }));
  return { ...coverageMapForReport,
    ...coverageMapForMissedFiles
  };
};

const listRelativeFileUrlToCover = async ({
  cancellationToken,
  projectDirectoryUrl,
  coverageConfig
}) => {
  const specifierMetaMapForCoverage = metaMapToSpecifierMetaMap({
    cover: coverageConfig
  });
  const matchingFileResultArray = await collectFiles({
    cancellationToken,
    directoryPath: fileUrlToPath(projectDirectoryUrl),
    specifierMetaMap: specifierMetaMapForCoverage,
    predicate: ({
      cover
    }) => cover
  });
  return matchingFileResultArray.map(({
    relativePath
  }) => relativePath);
};

const executionReportToCoverageMap = report => {
  const coverageMapArray = [];
  Object.keys(report).forEach(file => {
    const executionResultForFile = report[file];
    Object.keys(executionResultForFile).forEach(executionName => {
      const executionResultForFileOnPlatform = executionResultForFile[executionName];
      const {
        coverageMap
      } = executionResultForFileOnPlatform;

      if (!coverageMap) {
        // several reasons not to have coverageMap here:
        // 1. the file we executed did not import an instrumented file.
        // - a test file without import
        // - a test file importing only file excluded from coverage
        // - a coverDescription badly configured so that we don't realize
        // a file should be covered
        // 2. the file we wanted to executed timedout
        // - infinite loop
        // - too extensive operation
        // - a badly configured or too low allocatedMs for that execution.
        // 3. the file we wanted to execute contains syntax-error
        // in any scenario we are fine because
        // coverDescription will generate empty coverage for files
        // that were suppose to be coverage but were not.
        return;
      }

      coverageMapArray.push(coverageMap);
    });
  });
  const executionCoverageMap = composeCoverageMap(...coverageMapArray);
  return executionCoverageMap;
};

const cross = "☓"; // "\u2613"

const checkmark = "✔"; // "\u2714"

const yellow$1 = "\x1b[33m";
const magenta$1 = "\x1b[35m";
const red$1 = "\x1b[31m";
const green$1 = "\x1b[32m";
const grey = "\x1b[39m";
const ansiResetSequence = "\x1b[0m";

const formatDuration = duration => {
  const seconds = duration / 1000;
  const secondsWithTwoDecimalPrecision = Math.floor(seconds * 100) / 100;
  return `${secondsWithTwoDecimalPrecision}s`;
};

const createDisconnectedLog = ({
  fileRelativeUrl,
  platformName,
  platformVersion,
  consoleCalls,
  startMs,
  endMs
}) => {
  const color = magenta$1;
  const icon = cross;
  return `
${color}${icon} disconnected during execution.${ansiResetSequence}
file: ${fileRelativeUrl.slice(1)}
platform: ${formatPlatform({
    platformName,
    platformVersion
  })}${appendDuration({
    startMs,
    endMs
  })}${appendConsole(consoleCalls)}`;
};
const createTimedoutLog = ({
  fileRelativeUrl,
  platformName,
  platformVersion,
  consoleCalls,
  startMs,
  endMs,
  allocatedMs
}) => {
  const color = yellow$1;
  const icon = cross;
  return `
${color}${icon} execution takes more than ${allocatedMs}ms.${ansiResetSequence}
file: ${fileRelativeUrl.slice(1)}
platform: ${formatPlatform({
    platformName,
    platformVersion
  })}${appendDuration({
    startMs,
    endMs
  })}${appendConsole(consoleCalls)}`;
};
const createErroredLog = ({
  fileRelativeUrl,
  platformName,
  platformVersion,
  consoleCalls,
  startMs,
  endMs,
  error
}) => {
  const color = red$1;
  const icon = cross;
  return `
${color}${icon} error during execution.${ansiResetSequence}
file: ${fileRelativeUrl.slice(1)}
platform: ${formatPlatform({
    platformName,
    platformVersion
  })}${appendDuration({
    startMs,
    endMs
  })}${appendConsole(consoleCalls)}${appendError(error)}`;
};

const appendError = error => {
  if (!error) return ``;
  return `
error: ${error.stack}`;
};

const createCompletedLog = ({
  fileRelativeUrl,
  platformName,
  platformVersion,
  consoleCalls,
  startMs,
  endMs
}) => {
  const color = green$1;
  const icon = checkmark;
  return `
${color}${icon} execution completed.${ansiResetSequence}
file: ${fileRelativeUrl.slice(1)}
platform: ${formatPlatform({
    platformName,
    platformVersion
  })}${appendDuration({
    startMs,
    endMs
  })}${appendConsole(consoleCalls)}`;
};

const formatPlatform = ({
  platformName,
  platformVersion
}) => `${platformName}/${platformVersion}`;

const appendDuration = ({
  endMs,
  startMs
}) => {
  if (!endMs) return "";
  return `
duration: ${formatDuration(endMs - startMs)}`;
};

const appendConsole = consoleCalls => {
  if (!consoleCalls || consoleCalls.length === 0) return "";
  const consoleOutput = consoleCalls.reduce((previous, {
    text
  }) => {
    return `${previous}${text}`;
  }, "");
  const consoleOutputTrimmed = consoleOutput.trim();
  if (consoleOutputTrimmed === "") return "";
  return `
${grey}---------- console ----------${ansiResetSequence}
${consoleOutputTrimmed}
${grey}-------------------------${ansiResetSequence}`;
};

const createSummaryLog = summary => `
-------------- summary -----------------
${createSummaryMessage(summary)}${createTotalDurationMessage(summary)}
----------------------------------------
`;

const createSummaryMessage = ({
  executionCount,
  disconnectedCount,
  timedoutCount,
  erroredCount,
  completedCount
}) => {
  if (executionCount === 0) return `0 execution.`;
  return `${executionCount} execution: ${createSummaryDetails({
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount
  })}`;
};

const createSummaryDetails = ({
  executionCount,
  disconnectedCount,
  timedoutCount,
  erroredCount,
  completedCount
}) => {
  if (disconnectedCount === executionCount) {
    return createAllDisconnectedDetails();
  }

  if (timedoutCount === executionCount) {
    return createAllTimedoutDetails();
  }

  if (erroredCount === executionCount) {
    return createAllErroredDetails();
  }

  if (completedCount === executionCount) {
    return createAllCompletedDetails();
  }

  return createMixedDetails({
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount
  });
};

const createAllDisconnectedDetails = () => `all ${magenta$1}disconnected${ansiResetSequence}.`;

const createAllTimedoutDetails = () => `all ${yellow$1}timedout${ansiResetSequence}.`;

const createAllErroredDetails = () => `all ${red$1}errored${ansiResetSequence}.`;

const createAllCompletedDetails = () => `all ${green$1}completed${ansiResetSequence}.`;

const createMixedDetails = ({
  disconnectedCount,
  timedoutCount,
  erroredCount,
  completedCount
}) => {
  const parts = [];

  if (disconnectedCount) {
    parts.push(`${disconnectedCount} ${magenta$1}disconnected${ansiResetSequence}`);
  }

  if (timedoutCount) {
    parts.push(`${timedoutCount} ${yellow$1}timed out${ansiResetSequence}`);
  }

  if (erroredCount) {
    parts.push(`${erroredCount} ${red$1}errored${ansiResetSequence}`);
  }

  if (completedCount) {
    parts.push(`${completedCount} ${green$1}completed${ansiResetSequence}`);
  }

  return `${parts.join(", ")}.`;
};

const createTotalDurationMessage = ({
  startMs,
  endMs
}) => {
  if (!endMs) return "";
  return `
total duration: ${formatDuration(endMs - startMs)}`;
};

/* eslint-disable import/max-dependencies */
const executeConcurrently = async (executionSteps, {
  cancellationToken,
  logger,
  launchLogger,
  executeLogger,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  babelPluginMap,
  measurePlanExecutionDuration,
  concurrencyLimit = Math.max(os.cpus.length - 1, 1),
  executionDefaultOptions = {},
  logSummary,
  coverage,
  coverageConfig,
  coverageIncludeMissing
}) => {
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`);
  }

  const executionOptionsFromDefault = {
    allocatedMs: 30000,
    measureDuration: true,
    // mirrorConsole: false because file will be executed in parallel
    // so log would be a mess to read
    mirrorConsole: false,
    captureConsole: true,
    collectPlatformName: true,
    collectPlatformVersion: true,
    collectNamespace: false,
    collectCoverage: coverage,
    logSuccess: true,
    mainFileNotFoundCallback: ({
      fileRelativeUrl
    }) => {
      logger.error(new Error(`an execution main file does not exists.
--- file relative path ---
${fileRelativeUrl}`));
    },
    beforeExecutionCallback: () => {},
    afterExecutionCallback: () => {},
    ...executionDefaultOptions
  };
  let startMs;

  if (measurePlanExecutionDuration) {
    startMs = Date.now();
  }

  const report = {};
  await createConcurrentOperations({
    cancellationToken,
    concurrencyLimit,
    array: executionSteps,
    start: async executionOptionsFromStep => {
      const executionOptions = { ...executionOptionsFromDefault,
        ...executionOptionsFromStep
      };
      const {
        name,
        executionId,
        fileRelativeUrl,
        launch,
        allocatedMs,
        measureDuration,
        mirrorConsole,
        captureConsole,
        collectPlatformName,
        collectPlatformVersion,
        collectCoverage,
        collectNamespace,
        mainFileNotFoundCallback,
        beforeExecutionCallback,
        afterExecutionCallback,
        logSuccess
      } = executionOptions;
      const beforeExecutionInfo = {
        allocatedMs,
        name,
        executionId,
        fileRelativeUrl
      };
      const filePath = fileUrlToPath(`${projectDirectoryUrl}${fileRelativeUrl}`);
      const fileExists = await pathLeadsToFile(filePath);

      if (!fileExists) {
        mainFileNotFoundCallback(beforeExecutionInfo);
        return;
      }

      beforeExecutionCallback(beforeExecutionInfo);
      const executionResult = await launchAndExecute({
        cancellationToken,
        launchLogger,
        executeLogger,
        launch: params => launch({
          projectDirectoryUrl,
          jsenvDirectoryRelativeUrl,
          outDirectoryRelativeUrl,
          compileServerOrigin,
          ...params
        }),
        allocatedMs,
        measureDuration,
        collectPlatformName,
        collectPlatformVersion,
        mirrorConsole,
        captureConsole,
        // stopPlatformAfterExecute: true to ensure platform is stopped once executed
        // because we have what we wants: execution is completed and
        // we have associated coverageMap and capturedConsole
        stopPlatformAfterExecute: true,
        executionId,
        fileRelativeUrl,
        collectCoverage,
        collectNamespace
      });
      const afterExecutionInfo = { ...beforeExecutionInfo,
        ...executionResult
      };
      afterExecutionCallback(afterExecutionInfo);
      const {
        status
      } = executionResult;

      if (status === "completed" && logSuccess) {
        logger.info(createCompletedLog(afterExecutionInfo));
      } else if (status === "disconnected") {
        logger.info(createDisconnectedLog(afterExecutionInfo));
      } else if (status === "timedout") {
        logger.info(createTimedoutLog(afterExecutionInfo));
      } else if (status === "errored") {
        logger.info(createErroredLog(afterExecutionInfo));
      }

      if (fileRelativeUrl in report === false) {
        report[fileRelativeUrl] = {};
      }

      report[fileRelativeUrl][name] = executionResult;
    }
  });
  const summary = reportToSummary(report);

  if (measurePlanExecutionDuration) {
    summary.startMs = startMs;
    summary.endMs = Date.now();
  }

  if (logSummary) {
    logger.info(createSummaryLog(summary));
  }

  return {
    summary,
    report,
    ...(coverage ? {
      coverageMap: await reportToCoverageMap(report, {
        cancellationToken,
        projectDirectoryUrl,
        babelPluginMap,
        coverageConfig,
        coverageIncludeMissing
      })
    } : {})
  };
};

const pathLeadsToFile = path => new Promise((resolve, reject) => {
  fs.stat(path, (error, stats) => {
    if (error) {
      if (error.code === "ENOENT") {
        resolve(false);
      } else {
        reject(error);
      }
    } else {
      resolve(stats.isFile());
    }
  });
});

const reportToSummary = report => {
  const fileNames = Object.keys(report);
  const executionCount = fileNames.reduce((previous, fileName) => {
    return previous + Object.keys(report[fileName]).length;
  }, 0);

  const countResultMatching = predicate => {
    return fileNames.reduce((previous, fileName) => {
      const fileExecutionResult = report[fileName];
      return previous + Object.keys(fileExecutionResult).filter(executionName => {
        const fileExecutionResultForPlatform = fileExecutionResult[executionName];
        return predicate(fileExecutionResultForPlatform);
      }).length;
    }, 0);
  };

  const disconnectedCount = countResultMatching(({
    status
  }) => status === "disconnected");
  const timedoutCount = countResultMatching(({
    status
  }) => status === "timedout");
  const erroredCount = countResultMatching(({
    status
  }) => status === "errored");
  const completedCount = countResultMatching(({
    status
  }) => status === "completed");
  return {
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount
  };
};

const executePlan = async ({
  cancellationToken,
  compileServerLogLevel,
  logger,
  launchLogger,
  executeLogger,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileUrl,
  importDefaultExtension,
  babelPluginMap,
  convertMap,
  compileGroupCount,
  plan,
  measurePlanExecutionDuration,
  concurrencyLimit,
  executionDefaultOptions,
  logSummary,
  // coverage parameters
  coverage,
  coverageConfig,
  coverageIncludeMissing
} = {}) => {
  if (coverage) {
    const specifierMetaMapForCover = normalizeSpecifierMetaMap(metaMapToSpecifierMetaMap({
      cover: coverageConfig
    }), projectDirectoryUrl);
    babelPluginMap = { ...babelPluginMap,
      "transform-instrument": [createInstrumentBabelPlugin({
        predicate: ({
          relativeUrl
        }) => {
          return urlToMeta({
            url: resolveUrl$1(relativeUrl, projectDirectoryUrl),
            specifierMetaMap: specifierMetaMapForCover
          }).cover;
        }
      })]
    };
  }

  const [executionSteps, {
    origin: compileServerOrigin,
    jsenvDirectoryRelativeUrl: compileServerJsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl
  }] = await Promise.all([generateExecutionSteps(plan, {
    cancellationToken,
    projectDirectoryUrl
  }), startCompileServerForExecutingPlan({
    cancellationToken,
    compileServerLogLevel,
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    jsenvDirectoryClean,
    importMapFileUrl,
    importDefaultExtension,
    compileGroupCount,
    babelPluginMap,
    convertMap
  })]);
  const executionResult = await executeConcurrently(executionSteps, {
    cancellationToken,
    logger,
    launchLogger,
    executeLogger,
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl: compileServerJsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    compileServerOrigin,
    importMapFileUrl,
    importDefaultExtension,
    babelPluginMap,
    measurePlanExecutionDuration,
    concurrencyLimit,
    executionDefaultOptions,
    logSummary,
    coverage,
    coverageConfig,
    coverageIncludeMissing
  });
  return executionResult;
};

const executionIsPassed = ({
  summary
}) => summary.executionCount === summary.completedCount;

const generateCoverageJsonFile = async ({
  projectDirectoryUrl,
  coverageJsonFileRelativeUrl,
  coverageJsonFileLog,
  coverageMap
}) => {
  const coverageJsonFileUrl = resolveUrl$1(coverageJsonFileRelativeUrl, projectDirectoryUrl);
  const coverageJsonFilePath = fileUrlToPath(coverageJsonFileUrl);
  await writeFileContent(coverageJsonFilePath, JSON.stringify(coverageMap, null, "  "));

  if (coverageJsonFileLog) {
    console.log(`-> ${coverageJsonFilePath}`);
  }
};

const libReport = nodeRequire("istanbul-lib-report");

const reports = nodeRequire("istanbul-reports");

const {
  createCoverageMap
} = nodeRequire("istanbul-lib-coverage");

const generateCoverageHtmlDirectory = ({
  projectDirectoryUrl,
  coverageHtmlDirectoryRelativeUrl,
  coverageHtmlDirectoryIndexLog,
  coverageMap
}) => {
  const htmlDirectoryUrl = resolveDirectoryUrl(coverageHtmlDirectoryRelativeUrl, projectDirectoryUrl);
  const htmlDirectoryPath = fileUrlToPath(htmlDirectoryUrl);
  const context = libReport.createContext({
    dir: htmlDirectoryPath,
    coverageMap: createCoverageMap(coverageMap)
  });
  const report = reports.create("html", {
    skipEmpty: true,
    skipFull: true
  });
  report.execute(context);

  if (coverageHtmlDirectoryIndexLog) {
    const htmlCoverageDirectoryIndexFileUrl = `${htmlDirectoryUrl}index.html`;
    const htmlCoverageDirectoryIndexFilePath = fileUrlToPath(htmlCoverageDirectoryIndexFileUrl);
    console.log(`-> ${htmlCoverageDirectoryIndexFilePath}`);
  }
};

const libReport$1 = nodeRequire("istanbul-lib-report");

const reports$1 = nodeRequire("istanbul-reports");

const {
  createCoverageMap: createCoverageMap$1
} = nodeRequire("istanbul-lib-coverage");

const generateCoverageTextLog = ({
  coverageMap
}) => {
  const context = libReport$1.createContext({
    coverageMap: createCoverageMap$1(coverageMap)
  });
  const report = reports$1.create("text", {
    skipEmpty: true,
    skipFull: true
  });
  report.execute(context);
};

/* eslint-disable import/max-dependencies */
const executeTestPlan = async ({
  cancellationToken = createCancellationTokenForProcessSIGINT(),
  logLevel,
  compileServerLogLevel = "off",
  launchLogLevel = "off",
  executeLogLevel = "off",
  projectDirectoryPath,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  babelPluginMap,
  convertMap,
  compileGroupCount = 2,
  testPlan,
  measurePlanExecutionDuration = false,
  concurrencyLimit,
  executionDefaultOptions = {},
  logSummary = true,
  updateProcessExitCode = true,
  coverage = false,
  coverageConfig = {
    "./index.js": true,
    "./src/**/*.js": true,
    "./**/*.test.*": false,
    // contains .test. -> nope
    "./**/test/": false // inside a test folder -> nope,

  },
  coverageIncludeMissing = true,
  coverageAndExecutionAllowed = false,
  coverageTextLog = true,
  coverageJsonFile = Boolean(process.env.CI),
  coverageJsonFileLog = true,
  coverageJsonFileRelativeUrl = "./coverage/coverage-final.json",
  coverageHtmlDirectory = !process.env.CI,
  coverageHtmlDirectoryRelativeUrl = "./coverage",
  coverageHtmlDirectoryIndexLog = true
}) => {
  const logger = createLogger({
    logLevel
  });
  const launchLogger = createLogger({
    logLevel: launchLogLevel
  });
  const executeLogger = createLogger({
    logLevel: executeLogLevel
  });
  assertProjectDirectoryPath({
    projectDirectoryPath
  });
  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath);
  await assertProjectDirectoryExists({
    projectDirectoryUrl
  });

  if (typeof testPlan !== "object") {
    throw new Error(`testPlan must be an object, got ${testPlan}`);
  }

  if (coverage) {
    if (typeof coverageConfig !== "object") {
      throw new TypeError(`coverageConfig must be an object, got ${coverageConfig}`);
    }

    if (Object.keys(coverageConfig).length === 0) {
      logger.warn(`coverageConfig is an empty object. Nothing will be instrumented for coverage so your coverage will be empty`);
    }

    if (!coverageAndExecutionAllowed) {
      const fileSpecifierMapForExecute = normalizeSpecifierMetaMap(metaMapToSpecifierMetaMap({
        execute: testPlan
      }), "file:///");
      const fileSpecifierMapForCover = normalizeSpecifierMetaMap(metaMapToSpecifierMetaMap({
        cover: coverageConfig
      }), "file:///");
      const fileSpecifierMatchingCoverAndExecuteArray = Object.keys(fileSpecifierMapForExecute).filter(fileUrl => {
        return urlToMeta({
          url: fileUrl,
          specifierMetaMap: fileSpecifierMapForCover
        }).cover;
      });

      if (fileSpecifierMatchingCoverAndExecuteArray.length) {
        // I think it is an error, it would be strange, for a given file
        // to be both covered and executed
        throw new Error(`some file will be both covered and executed
--- specifiers ---
${fileSpecifierMatchingCoverAndExecuteArray.join("\n")}`);
      }
    }
  }

  return catchAsyncFunctionCancellation(async () => {
    const result = await executePlan({
      cancellationToken,
      compileServerLogLevel,
      logger,
      launchLogger,
      executeLogger,
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      importMapFileRelativeUrl,
      importDefaultExtension,
      babelPluginMap,
      convertMap,
      compileGroupCount,
      plan: testPlan,
      measurePlanExecutionDuration,
      concurrencyLimit,
      executionDefaultOptions,
      logSummary,
      coverage,
      coverageConfig,
      coverageIncludeMissing
    });

    if (updateProcessExitCode && !executionIsPassed(result)) {
      process.exitCode = 1;
    }

    const promises = [];

    if (coverage && coverageJsonFile) {
      promises.push(generateCoverageJsonFile({
        projectDirectoryUrl,
        coverageJsonFileRelativeUrl,
        coverageJsonFileLog,
        coverageMap: result.coverageMap
      }));
    }

    if (coverage && coverageHtmlDirectory) {
      promises.push(generateCoverageHtmlDirectory({
        coverageMap: result.coverageMap,
        projectDirectoryUrl,
        coverageHtmlDirectoryRelativeUrl,
        coverageHtmlDirectoryIndexLog
      }));
    }

    if (coverage && coverageTextLog) {
      promises.push(generateCoverageTextLog({
        coverageMap: result.coverageMap
      }));
    }

    await Promise.all(promises);
    return result;
  });
};

/* eslint-disable import/max-dependencies */
const generateBundle = async ({
  cancellationToken = createCancellationTokenForProcessSIGINT(),
  logLevel = "info",
  compileServerLogLevel = "warn",
  logger,
  projectDirectoryPath,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  env = {},
  browser = false,
  node = false,
  babelPluginMap = jsenvBabelPluginMap,
  compileGroupCount = 1,
  platformScoreMap = { ...jsenvBrowserScoreMap,
    node: jsenvNodeVersionScoreMap
  },
  balancerTemplateFileUrl,
  entryPointMap = {
    main: "./index.js"
  },
  bundleDirectoryRelativeUrl,
  bundleDirectoryClean = false,
  format,
  formatOutputOptions = {},
  minify = false,
  sourcemapExcludeSources = true,
  writeOnFileSystem = true,
  // when true .jsenv/out-bundle directory is generated
  // with all intermediated files used to produce the final bundle.
  // it might improve generateBundle speed for subsequent bundle generation
  // but this is to be proven and not absolutely required
  // When false intermediates files are transformed and served in memory
  // by the compile server
  // must be true by default otherwise rollup cannot find sourcemap files
  // when asking them to the compile server
  // (to fix that sourcemap could be inlined)
  filesystemCache = true,
  ...rest
}) => {
  logger = logger || createLogger({
    logLevel
  });
  assertProjectDirectoryPath({
    projectDirectoryPath
  });
  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath);
  await assertProjectDirectoryExists({
    projectDirectoryUrl
  });
  assertEntryPointMap({
    entryPointMap
  });
  assertBundleDirectoryRelativeUrl({
    bundleDirectoryRelativeUrl
  });
  const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativeUrl, projectDirectoryUrl);
  assertBundleDirectoryInsideProject({
    bundleDirectoryUrl,
    projectDirectoryUrl
  });

  if (bundleDirectoryClean) {
    await removeDirectory(fileUrlToPath(bundleDirectoryUrl));
  }

  const chunkId = `${Object.keys(entryPointMap)[0]}.js`;
  env = { ...env,
    chunkId
  };
  babelPluginMap = { ...babelPluginMap,
    ...createBabePluginMapForBundle({
      format
    })
  };
  assertCompileGroupCount({
    compileGroupCount
  });

  if (compileGroupCount > 1) {
    if (typeof balancerTemplateFileUrl === "undefined") {
      throw new Error(`${format} format not compatible with balancing.`);
    }

    await assertFileExists(balancerTemplateFileUrl);
  }

  return catchAsyncFunctionCancellation(async () => {
    const {
      outDirectoryRelativeUrl,
      origin: compileServerOrigin,
      compileServerImportMap,
      compileServerGroupMap
    } = await startCompileServer({
      cancellationToken,
      compileServerLogLevel,
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      outDirectoryName: "out-bundle",
      importMapFileRelativeUrl,
      importDefaultExtension,
      env,
      babelPluginMap,
      compileGroupCount,
      platformScoreMap,
      writeOnFilesystem: filesystemCache,
      useFilesystemAsCache: filesystemCache,
      // override with potential custom options
      ...rest,
      transformModuleIntoSystemFormat: false // will be done by rollup

    });

    if (compileGroupCount === 1) {
      return generateBundleUsingRollup({
        cancellationToken,
        logger,
        projectDirectoryUrl,
        entryPointMap,
        bundleDirectoryUrl,
        compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/`,
        compileServerOrigin,
        compileServerImportMap,
        importDefaultExtension,
        babelPluginMap,
        node,
        browser,
        minify,
        format,
        formatOutputOptions,
        writeOnFileSystem,
        sourcemapExcludeSources
      });
    }

    return await Promise.all([generateEntryPointsDirectories({
      cancellationToken,
      logger,
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      bundleDirectoryUrl,
      entryPointMap,
      compileServerOrigin,
      compileServerImportMap,
      importDefaultExtension,
      babelPluginMap,
      compileServerGroupMap,
      node,
      browser,
      format,
      formatOutputOptions,
      minify,
      writeOnFileSystem,
      sourcemapExcludeSources
    }), generateEntryPointsBalancerFiles({
      cancellationToken,
      logger,
      projectDirectoryUrl,
      balancerTemplateFileUrl,
      outDirectoryRelativeUrl,
      entryPointMap,
      bundleDirectoryUrl,
      compileServerOrigin,
      compileServerImportMap,
      importDefaultExtension,
      babelPluginMap,
      node,
      browser,
      format,
      minify,
      writeOnFileSystem,
      sourcemapExcludeSources
    })]);
  });
};

const assertEntryPointMap = ({
  entryPointMap
}) => {
  if (typeof entryPointMap !== "object") {
    throw new TypeError(`entryPointMap must be an object, got ${entryPointMap}`);
  }

  Object.keys(entryPointMap).forEach(entryName => {
    const entryRelativeUrl = entryPointMap[entryName];

    if (typeof entryRelativeUrl !== "string") {
      throw new TypeError(`found unexpected value in entryPointMap, it must be a string but found ${entryRelativeUrl} for key ${entryName}`);
    }

    if (!entryRelativeUrl.startsWith("./")) {
      throw new TypeError(`found unexpected value in entryPointMap, it must start with ./ but found ${entryRelativeUrl} for key ${entryName}`);
    }
  });
};

const assertBundleDirectoryRelativeUrl = ({
  bundleDirectoryRelativeUrl
}) => {
  if (typeof bundleDirectoryRelativeUrl !== "string") {
    throw new TypeError(`bundleDirectoryRelativeUrl must be a string, received ${bundleDirectoryRelativeUrl}`);
  }
};

const assertBundleDirectoryInsideProject = ({
  bundleDirectoryUrl,
  projectDirectoryUrl
}) => {
  if (!bundleDirectoryUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`bundle directory must be inside project directory
--- bundle directory url ---
${bundleDirectoryUrl}
--- project directory url ---
${projectDirectoryUrl}`);
  }
};

const assertCompileGroupCount = ({
  compileGroupCount
}) => {
  if (typeof compileGroupCount !== "number") {
    throw new TypeError(`compileGroupCount must be a number, got ${compileGroupCount}`);
  }

  if (compileGroupCount < 1) {
    throw new Error(`compileGroupCount must be >= 1, got ${compileGroupCount}`);
  }
};

const generateEntryPointsDirectories = ({
  compileServerGroupMap,
  bundleDirectoryUrl,
  outDirectoryRelativeUrl,
  ...rest
}) => Promise.all(Object.keys(compileServerGroupMap).map(compileId => generateBundleUsingRollup({
  bundleDirectoryUrl: resolveDirectoryUrl(compileId, bundleDirectoryUrl),
  compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${compileId}/`,
  ...rest
})));

const generateEntryPointsBalancerFiles = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  entryPointMap,
  balancerTemplateFileUrl,
  ...rest
}) => Promise.all(Object.keys(entryPointMap).map(entryPointName => generateBundleUsingRollup({
  projectDirectoryUrl,
  compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/`,
  entryPointMap: {
    [entryPointName]: urlToRelativeUrl(balancerTemplateFileUrl, projectDirectoryUrl)
  },
  sourcemapExcludeSources: true,
  ...rest,
  format: "global"
})));

const generateCommonJsBundle = async ({
  bundleDirectoryRelativeUrl = "./dist/commonjs",
  node = true,
  ...rest
}) => generateBundle({
  format: "commonjs",
  bundleDirectoryRelativeUrl,
  node,
  balancerTemplateFileUrl: resolveUrl$1("./src/internal/bundling/commonjs-balancer-template.js", jsenvCoreDirectoryUrl),
  ...rest
});

const generateCommonJsBundleForNode = ({
  babelPluginMap = jsenvBabelPluginMap,
  bundleDirectoryRelativeUrl,
  nodeMinimumVersion = decideNodeMinimumVersion(),
  ...rest
}) => {
  const babelPluginMapForNode = computeBabelPluginMapForPlatform({
    babelPluginMap,
    platformName: "node",
    platformVersion: nodeMinimumVersion
  });
  return generateCommonJsBundle({
    bundleDirectoryRelativeUrl,
    compileGroupCount: 1,
    babelPluginMap: babelPluginMapForNode,
    ...rest
  });
};

const decideNodeMinimumVersion = () => {
  return process.version.slice(1);
};

const generateGlobalBundle = async ({
  bundleDirectoryRelativeUrl = "./dist/global",
  globalName,
  browser = true,
  ...rest
}) => generateBundle({
  format: "global",
  browser,
  formatOutputOptions: globalName ? {
    name: globalName
  } : {},
  bundleDirectoryRelativeUrl,
  compileGroupCount: 1,
  ...rest
});

const generateSystemJsBundle = async ({
  bundleDirectoryRelativeUrl = "./dist/systemjs",
  ...rest
}) => generateBundle({
  format: "systemjs",
  balancerTemplateFileUrl: resolveUrl$1("./src/internal/bundling/systemjs-balancer-template.js", jsenvCoreDirectoryUrl),
  bundleDirectoryRelativeUrl,
  ...rest
});

const jsenvHtmlFileUrl = resolveUrl$1("./src/internal/jsenv-html-file.html", jsenvCoreDirectoryUrl);

const closePage = async page => {
  try {
    await page.close();
  } catch (e) {
    if (e.message.match(/^Protocol error \(.*?\): Target closed/)) {
      return;
    }

    throw e;
  }
};

const trackRessources$1 = () => {
  const callbackArray = [];

  const registerCleanupCallback = callback => {
    if (typeof callback !== "function") throw new TypeError(`callback must be a function
callback: ${callback}`);
    callbackArray.push(callback);
    return () => {
      const index = callbackArray.indexOf(callback);
      if (index > -1) callbackArray.splice(index, 1);
    };
  };

  const cleanup = async reason => {
    const localCallbackArray = callbackArray.slice();
    await Promise.all(localCallbackArray.map(callback => callback(reason)));
  };

  return {
    registerCleanupCallback,
    cleanup
  };
};

const puppeteer = nodeRequire("puppeteer");

const launchPuppeteer = async ({
  cancellationToken = createCancellationToken(),
  headless = true,
  stopOnExit = true,
  stopOnSIGINT = true
}) => {
  const options = {
    headless,
    // because we use a self signed certificate
    ignoreHTTPSErrors: true,
    args: [// https://github.com/GoogleChrome/puppeteer/issues/1834
      // https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#tips
      // "--disable-dev-shm-usage",
    ]
  };
  const {
    registerCleanupCallback,
    cleanup
  } = trackRessources$1();
  const browserOperation = createStoppableOperation({
    cancellationToken,
    start: () => puppeteer.launch({ ...options,
      // let's handle them to close properly browser, remove listener
      // and so on, instead of relying on puppetter
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    }),
    stop: async (browser, reason) => {
      await cleanup(reason);
      const disconnectedPromise = new Promise(resolve => {
        const disconnectedCallback = () => {
          browser.removeListener("disconnected", disconnectedCallback);
          resolve();
        };

        browser.on("disconnected", disconnectedCallback);
      });
      await browser.close();
      await disconnectedPromise;
    }
  });
  const {
    stop
  } = browserOperation;

  if (stopOnExit) {
    const unregisterProcessTeadown = teardownSignal.addCallback(reason => {
      stop(`process ${reason}`);
    });
    registerCleanupCallback(unregisterProcessTeadown);
  }

  if (stopOnSIGINT) {
    const unregisterProcessInterrupt = interruptSignal.addCallback(() => {
      stop("process sigint");
    });
    registerCleanupCallback(unregisterProcessInterrupt);
  }

  const browser = await browserOperation;
  return {
    browser,
    stopBrowser: stop
  };
};

const startChromiumServer = async ({
  cancellationToken,
  logLevel = "off",
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin
}) => {
  const chromiumJsFileUrl = resolveUrl$1("./src/internal/chromium-launcher/chromium-js-file.js", jsenvCoreDirectoryUrl);
  const chromiumJsFileRelativeUrl = urlToRelativeUrl(chromiumJsFileUrl, projectDirectoryUrl);
  const chromiumBundledJsFileRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_GLOBAL_BUNDLE}/${chromiumJsFileRelativeUrl}`;
  const chromiumBundledJsFileRemoteUrl = `${compileServerOrigin}/${chromiumBundledJsFileRelativeUrl}`;
  return startServer({
    cancellationToken,
    logLevel,
    sendInternalErrorStack: true,
    requestToResponse: request => firstService(() => {
      if (request.ressource === "/.jsenv/browser-script.js") {
        return {
          status: 307,
          headers: {
            location: chromiumBundledJsFileRemoteUrl
          }
        };
      }

      return null;
    }, () => {
      if (request.ressource.startsWith("/node_modules/source-map/")) {
        const specifier = request.ressource.slice("/node_modules/".length);

        const filePath = nodeRequire.resolve(specifier);

        return serveFile(filePath, {
          method: request.method,
          headers: request.headers
        });
      }

      return null;
    }, () => {
      return serveFile(`${projectDirectoryUrl}${request.ressource.slice(1)}`, {
        method: request.method,
        headers: request.headers
      });
    })
  });
};

const trackPageTargets = (page, callback) => {
  let allDestroyedRegistrationArray = [];
  const pendingDestroyedPromiseArray = [];
  const targetArray = [];

  const trackContextTargets = browserContext => {
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-target
    browserContext.on("targetcreated", targetcreatedCallback);
    browserContext.on("targetdestroyed", targetdestroyedCallback);
    return async () => {
      browserContext.removeListener("targetcreated", targetcreatedCallback);
      browserContext.removeListener("targetdestroyed", targetdestroyedCallback);
      await Promise.all(pendingDestroyedPromiseArray);
    };
  };

  const targetcreatedCallback = async target => {
    targetArray.push(target);
    const type = target.type();

    if (type === "browser") {
      registerTargetDestroyed(target, trackContextTargets(target.browserContext()));
    }

    const returnValue = await callback({
      target,
      type
    });

    if (typeof returnValue === "function") {
      registerTargetDestroyed(target, returnValue);
    }
  };

  const registerTargetDestroyed = (target, callback) => {
    allDestroyedRegistrationArray.push({
      target,
      callback
    });
  };

  const targetdestroyedCallback = async target => {
    const targetIndex = targetArray.indexOf(target);

    if (targetIndex === -1) {
      console.warn("untracked target destroyed");
    } else {
      const destroyedRegistrationArray = [];
      const otherDestroyedRegistrationArray = [];
      destroyedRegistrationArray.forEach(destroyedRegistration => {
        if (destroyedRegistration.target === target) {
          destroyedRegistrationArray.push(destroyedRegistration);
        } else {
          otherDestroyedRegistrationArray.push(destroyedRegistration);
        }
      });
      allDestroyedRegistrationArray = otherDestroyedRegistrationArray;
      const pendingDestroyedPromise = Promise.all(destroyedRegistrationArray.map(destroyedRegistration => destroyedRegistration.callback()));
      pendingDestroyedPromiseArray.push(pendingDestroyedPromise);
      await pendingDestroyedPromise;
      pendingDestroyedPromiseArray.splice(pendingDestroyedPromiseArray.indexOf(pendingDestroyedPromise), 1);
    }
  };

  return trackContextTargets(page.browserContext());
};

const trackPageTargetsToClose = page => {
  return trackPageTargets(page, ({
    target,
    type
  }) => {
    if (type === "browser") return null;

    if (type === "page" || type === "background_page") {
      // in case of bug do not forget https://github.com/GoogleChrome/puppeteer/issues/2269
      return async () => {
        const page = await target.page();
        return closePage(page);
      };
    }

    return null;
  });
};

const trackPageTargetsToNotify = (page, {
  onError,
  onConsole,
  trackOtherPages = false
}) => {
  const trackEvents = page => {
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
    const removeErrorListener = registerEvent({
      object: page,
      eventType: "error",
      callback: onError
    }); // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror

    const removePageErrorListener = registerEvent({
      object: page,
      eventType: "pageerror",
      callback: onError
    }); // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-console

    const removeConsoleListener = registerEvent({
      object: page,
      eventType: "console",
      callback: async message => {
        onConsole({
          type: message.type(),
          text: appendNewLine((await extractTextFromPuppeteerMessage(message)))
        });
      }
    });
    return () => {
      removeErrorListener();
      removePageErrorListener();
      removeConsoleListener();
    };
  };

  const stopEventTracking = trackEvents(page);

  if (!trackOtherPages) {
    return stopEventTracking;
  }

  const stopPageTracking = trackPageTargets(page, async ({
    target,
    type
  }) => {
    if (type === "browser") return null;

    if (type === "page" || type === "background_page") {
      const page = await target.page();
      return trackEvents(page);
    }

    return null;
  });
  return async () => {
    await stopEventTracking();
    await stopPageTracking();
  };
};

const registerEvent = ({
  object,
  eventType,
  callback
}) => {
  object.on(eventType, callback);
  return () => {
    object.removeListener(eventType, callback);
  };
};

const appendNewLine = string => `${string}
`; // https://github.com/GoogleChrome/puppeteer/issues/3397#issuecomment-434970058
// https://github.com/GoogleChrome/puppeteer/issues/2083


const extractTextFromPuppeteerMessage = async message => {
  return message.text(); // ensure we use a string so that istanbul won't try
  // to put any coverage statement inside it
  // ideally we should use uneval no ?
  // eslint-disable-next-line no-new-func
  //   const functionEvaluatedBrowserSide = new Function(
  //     "value",
  //     `if (value instanceof Error) {
  //   return value.stack
  // }
  // return value`,
  //   )
  //   const argValues = await Promise.all(
  //     message.args().map(async (arg) => {
  //       const jsHandle = arg
  //       try {
  //         return await jsHandle.executionContext().evaluate(functionEvaluatedBrowserSide, jsHandle)
  //       } catch (e) {
  //         return String(jsHandle)
  //       }
  //     }),
  //   )
  //   const text = argValues.reduce((previous, value, index) => {
  //     let string
  //     if (typeof value === "object") string = JSON.stringify(value, null, "  ")
  //     else string = String(value)
  //     if (index === 0) return `${previous}${string}`
  //     return `${previous} ${string}`
  //   }, "")
  //   return text
};

const evalSource = (code, filePath) => {
  const script = new vm.Script(code, {
    filename: filePath
  });
  return script.runInThisContext();
};

// https://github.com/benjamingr/RegExp.escape/blob/master/polyfill.js
const escapeRegexpSpecialCharacters = string => {
  string = String(string);
  let i = 0;
  let escapedString = "";

  while (i < string.length) {
    const char = string[i];
    i++;
    escapedString += isRegExpSpecialChar(char) ? `\\${char}` : char;
  }

  return escapedString;
};

const isRegExpSpecialChar = char => regexpSpecialChars.indexOf(char) > -1;

const regexpSpecialChars = ["/", "^", "\\", "[", "]", "(", ")", "{", "}", "?", "+", "*", ".", "|", "$"];

const evaluateImportExecution = async ({
  cancellationToken,
  projectDirectoryUrl,
  htmlFileUrl,
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  compileServerOrigin,
  executionServerOrigin,
  page,
  collectNamespace,
  collectCoverage,
  executionId,
  errorStackRemapping,
  executionExposureOnWindow
}) => {
  if (!htmlFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`chromium html file must be inside project directory
--- chromium html file url ---
${htmlFileUrl}
--- project directory url ---
${htmlFileUrl}`);
  }

  await assertFileExists(htmlFileUrl);
  const fileUrl = resolveUrl$1(fileRelativeUrl, projectDirectoryUrl);
  await assertFileExists(fileUrl);
  const htmlFileRelativeUrl = urlToRelativeUrl(htmlFileUrl, projectDirectoryUrl);
  const htmlFileClientUrl = `${executionServerOrigin}/${htmlFileRelativeUrl}`;
  await page.goto(htmlFileClientUrl); // https://github.com/GoogleChrome/puppeteer/blob/v1.14.0/docs/api.md#pageevaluatepagefunction-args
  // yes evaluate supports passing a function directly
  // but when I do that, istanbul will put coverage statement inside it
  // and I don't want that because function is evaluated client side

  const javaScriptExpressionSource = createBrowserIIFEString({
    outDirectoryRelativeUrl,
    fileRelativeUrl,
    compileServerOrigin,
    collectNamespace,
    collectCoverage,
    executionId,
    errorStackRemapping,
    executionExposureOnWindow
  });

  try {
    const executionResult = await page.evaluate(javaScriptExpressionSource);
    const {
      status
    } = executionResult;

    if (status === "errored") {
      const {
        exceptionSource,
        coverageMap
      } = executionResult;
      return {
        status,
        error: evalException(exceptionSource, {
          projectDirectoryUrl,
          compileServerOrigin
        }),
        coverageMap
      };
    }

    const {
      namespace,
      coverageMap
    } = executionResult;
    return {
      status,
      namespace,
      coverageMap
    };
  } catch (e) {
    // if browser is closed due to cancellation
    // before it is able to finish evaluate we can safely ignore
    // and rethrow with current cancelError
    if (e.message.match(/^Protocol error \(.*?\): Target closed/) && cancellationToken.cancellationRequested) {
      cancellationToken.throwIfRequested();
    }

    throw e;
  }
};

const evalException = (exceptionSource, {
  projectDirectoryUrl,
  compileServerOrigin
}) => {
  const error = evalSource(exceptionSource);

  if (error && error instanceof Error) {
    const remoteRootRegexp = new RegExp(escapeRegexpSpecialCharacters(`${compileServerOrigin}/`), "g");
    error.stack = error.stack.replace(remoteRootRegexp, projectDirectoryUrl);
    error.message = error.message.replace(remoteRootRegexp, projectDirectoryUrl);
  }

  return error;
};

const createBrowserIIFEString = ({
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  compileServerOrigin,
  collectNamespace,
  collectCoverage,
  executionId,
  errorStackRemapping,
  executionExposureOnWindow
}) => `(() => {
  return window.execute(${JSON.stringify({
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  compileServerOrigin,
  collectNamespace,
  collectCoverage,
  executionId,
  errorStackRemapping,
  executionExposureOnWindow
}, null, "    ")})
})()`;

const createRessource = ({
  share = false,
  start,
  stop
}) => {
  if (!share) {
    let ressource;

    const startUsing = (...args) => {
      ressource = start(...args);

      const stopUsing = () => {
        const value = ressource;
        ressource = undefined;
        return stop(value);
      };

      return {
        ressource,
        stopUsing
      };
    };

    return {
      startUsing
    };
  }

  const cacheMap = {};

  const startUsing = (...args) => {
    const cacheId = argsToId(args);
    let cache;

    if (cacheId in cacheMap) {
      cache = cacheMap[cacheId];
    } else {
      cache = {
        useCount: 0,
        ressource: undefined
      };
      cacheMap[cacheId] = cache;
    }

    if (cache.useCount === 0) {
      cache.ressource = start(...args);
    }

    cache.useCount++;
    let stopped = false;
    let stopUsingReturnValue;

    const stopUsing = () => {
      if (stopped) {
        // in case stopUsing is called more than once
        return stopUsingReturnValue;
      }

      stopped = true;
      cache.useCount--;

      if (cache.useCount === 0) {
        const value = cache.ressource;
        cache.ressource = undefined;
        delete cacheMap[cacheId];
        stopUsingReturnValue = stop(value);
        return stopUsingReturnValue;
      }

      stopUsingReturnValue = undefined;
      return stopUsingReturnValue;
    };

    return {
      ressource: cache.ressource,
      stopUsing
    };
  };

  return {
    startUsing
  };
};

const argsToId = args => JSON.stringify(args);

// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md
let browserRessource;
let executionServerRessource;
const launchChromium = async ({
  cancellationToken = createCancellationToken(),
  clientServerLogLevel,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  headless = true,
  shareBrowser = false
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`);
  }

  const {
    registerCleanupCallback,
    cleanup
  } = trackRessources$1();

  if (!browserRessource) {
    browserRessource = createRessource({
      share: shareBrowser,
      start: ({
        headless
      }) => {
        return launchPuppeteer({
          cancellationToken,
          headless
        });
      },
      stop: async browserPromise => {
        const {
          stopBrowser
        } = await browserPromise;
        await stopBrowser();
      }
    });
  }

  const browserRessourceUsage = browserRessource.startUsing({
    headless
  });
  registerCleanupCallback(() => {
    if (shareBrowser) {
      // give 10ms for anything to startUsing browserRessource
      // before actually marking it as unused
      // so that we maximize the chances to reuse the browser
      // and only delay the moment it will be killed by 10ms
      setTimeout(() => {
        browserRessourceUsage.stopUsing();
      }, 100);
    } else {
      browserRessourceUsage.stopUsing();
    }
  });
  const {
    browser
  } = await browserRessourceUsage.ressource;

  const registerDisconnectCallback = callback => {
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    browser.on("disconnected", callback);
    registerCleanupCallback(() => {
      browser.removeListener("disconnected", callback);
    });
  };

  const errorCallbackArray = [];

  const registerErrorCallback = callback => {
    errorCallbackArray.push(callback);
  };

  const consoleCallbackArray = [];

  const registerConsoleCallback = callback => {
    consoleCallbackArray.push(callback);
  };

  const executeFile = async (fileRelativeUrl, {
    htmlFileUrl = jsenvHtmlFileUrl,
    incognito = false,
    collectNamespace,
    collectCoverage,
    executionId,
    errorStackRemapping = true
  }) => {
    if (!executionServerRessource) {
      executionServerRessource = createRessource({
        share: true,
        start: () => {
          return startChromiumServer({
            cancellationToken,
            logLevel: clientServerLogLevel,
            projectDirectoryUrl,
            outDirectoryRelativeUrl,
            compileServerOrigin
          });
        },
        stop: async serverPromise => {
          const server = await serverPromise;
          await server.stop();
        }
      });
    }

    const executionServerUsage = executionServerRessource.startUsing();
    registerCleanupCallback(executionServerUsage.stopUsing);
    const executionServer = await executionServerUsage.ressource; // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#browsercreateincognitobrowsercontext

    const browserContextPromise = incognito ? browser.createIncognitoBrowserContext() : browser.defaultBrowserContext();
    const browserContext = await browserContextPromise;
    const page = await browserContext.newPage();

    if (incognito || !shareBrowser) {
      // in incognito mode, browser context is not shared by tabs
      // it means if a tab open an other page/tab we'll know
      // it comes form that tab and not an other one
      // when browser is not shared we know an opened page comes from
      // that execution
      const stopTrackingToClose = trackPageTargetsToClose(page);
      registerCleanupCallback(stopTrackingToClose);
      registerCleanupCallback(() => closePage(page));
    } else {
      // when browser is shared and execution happens in the default
      // browser context (not incognito)
      // we'll only try to close the tab we created
      // otherwise we might kill tab opened by potential parallel execution.
      // A consequence might be to leave opened tab alive
      // (it means js execution opens an other tab, not supposed to happen a lot)
      registerCleanupCallback(() => closePage(page));
    }

    const stopTrackingToNotify = trackPageTargetsToNotify(page, {
      onError: error => {
        errorCallbackArray.forEach(callback => {
          callback(error);
        });
      },
      onConsole: ({
        type,
        text
      }) => {
        consoleCallbackArray.forEach(callback => {
          callback({
            type,
            text
          });
        });
      },
      // we track other pages only in incognito mode because
      // we know for sure opened tabs comes from this one
      // and not from a potential parallel execution
      trackOtherPages: incognito || !shareBrowser
    });
    registerCleanupCallback(stopTrackingToNotify);
    return evaluateImportExecution({
      cancellationToken,
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      htmlFileUrl,
      fileRelativeUrl,
      compileServerOrigin,
      executionServerOrigin: executionServer.origin,
      page,
      collectNamespace,
      collectCoverage,
      executionId,
      errorStackRemapping
    });
  };

  return {
    name: "chromium",
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteer-api-tip-of-tree
    // https://github.com/GoogleChrome/puppeteer#q-why-doesnt-puppeteer-vxxx-work-with-chromium-vyyy
    // to keep in sync when updating puppeteer
    version: "79.0.3942.0",
    options: {
      headless
    },
    stop: cleanup,
    registerDisconnectCallback,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile
  };
};

const launchChromiumTab = namedArgs => launchChromium({
  shareBrowser: true,
  ...namedArgs
});

// https://developer.mozilla.org/en-US/docs/Glossary/Primitive
const isComposite = value => {
  if (value === null) return false;
  const type = typeof value;
  if (type === "object") return true;
  if (type === "function") return true;
  return false;
};

const compositeWellKnownMap = new WeakMap();
const primitiveWellKnownMap = new Map();
const getCompositeGlobalPath = value => compositeWellKnownMap.get(value);
const getPrimitiveGlobalPath = value => primitiveWellKnownMap.get(value);

const visitGlobalObject = value => {
  const visitValue = (value, path) => {
    if (isComposite(value)) {
      if (compositeWellKnownMap.has(value)) return; // prevent infinite recursion

      compositeWellKnownMap.set(value, path);

      const visitProperty = property => {
        let descriptor;

        try {
          descriptor = Object.getOwnPropertyDescriptor(value, property);
        } catch (e) {
          if (e.name === "SecurityError") {
            return;
          }

          throw e;
        } // do not trigger getter/setter


        if ("value" in descriptor) {
          const propertyValue = descriptor.value;
          visitValue(propertyValue, [...path, property]);
        }
      };

      Object.getOwnPropertyNames(value).forEach(name => visitProperty(name));
      Object.getOwnPropertySymbols(value).forEach(symbol => visitProperty(symbol));
    }

    primitiveWellKnownMap.set(value, path);
    return;
  };

  visitValue(value, []);
};

if (typeof window === "object") visitGlobalObject(window);
if (typeof global === "object") visitGlobalObject(global);

/**
 * transforms a javascript value into an object describing it.
 *
 */
const decompose = (mainValue, {
  functionAllowed,
  prototypeStrict
}) => {
  const valueMap = {};
  const recipeArray = [];

  const valueToIdentifier = (value, path = []) => {
    if (!isComposite(value)) {
      const existingIdentifier = identifierForPrimitive(value);
      if (existingIdentifier !== undefined) return existingIdentifier;
      const identifier = identifierForNewValue(value);
      recipeArray[identifier] = primitiveToRecipe(value);
      return identifier;
    }

    if (typeof Promise === "function" && value instanceof Promise) throw new Error(createPromiseAreNotSupportedMessage({
      path
    }));
    if (typeof WeakSet === "function" && value instanceof WeakSet) throw new Error(createWeakSetAreNotSupportedMessage({
      path
    }));
    if (typeof WeakMap === "function" && value instanceof WeakMap) throw new Error(createWeakMapAreNotSupportedMessage({
      path
    }));
    if (typeof value === "function" && !functionAllowed) throw new Error(createForbiddenFunctionMessage({
      path
    }));
    const existingIdentifier = identifierForComposite(value);
    if (existingIdentifier !== undefined) return existingIdentifier;
    const identifier = identifierForNewValue(value);
    const compositeGlobalPath = getCompositeGlobalPath(value);

    if (compositeGlobalPath) {
      recipeArray[identifier] = createGlobalReferenceRecipe(compositeGlobalPath);
      return identifier;
    }

    const propertyDescriptionArray = [];
    Object.getOwnPropertyNames(value).forEach(propertyName => {
      const propertyDescriptor = Object.getOwnPropertyDescriptor(value, propertyName);
      const propertyNameIdentifier = valueToIdentifier(propertyName, [...path, propertyName]);
      const propertyDescription = computePropertyDescription(propertyDescriptor, propertyName, path);
      propertyDescriptionArray.push({
        propertyNameIdentifier,
        propertyDescription
      });
    });
    const symbolDescriptionArray = [];
    Object.getOwnPropertySymbols(value).forEach(symbol => {
      const propertyDescriptor = Object.getOwnPropertyDescriptor(value, symbol);
      const symbolIdentifier = valueToIdentifier(symbol, [...path, `[${symbol.toString()}]`]);
      const propertyDescription = computePropertyDescription(propertyDescriptor, symbol, path);
      symbolDescriptionArray.push({
        symbolIdentifier,
        propertyDescription
      });
    });
    const methodDescriptionArray = computeMethodDescriptionArray(value, path);
    const extensible = Object.isExtensible(value);
    recipeArray[identifier] = createCompositeRecipe({
      propertyDescriptionArray,
      symbolDescriptionArray,
      methodDescriptionArray,
      extensible
    });
    return identifier;
  };

  const computePropertyDescription = (propertyDescriptor, propertyNameOrSymbol, path) => {
    if (propertyDescriptor.set && !functionAllowed) throw new Error(createForbiddenPropertySetterMessage({
      path,
      propertyNameOrSymbol
    }));
    if (propertyDescriptor.get && !functionAllowed) throw new Error(createForbiddenPropertyGetterMessage({
      path,
      propertyNameOrSymbol
    }));
    return {
      configurable: propertyDescriptor.configurable,
      writable: propertyDescriptor.writable,
      enumerable: propertyDescriptor.enumerable,
      getIdentifier: "get" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.get, [...path, String(propertyNameOrSymbol), "[[descriptor:get]]"]) : undefined,
      setIdentifier: "set" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.set, [...path, String(propertyNameOrSymbol), "[[descriptor:set]]"]) : undefined,
      valueIdentifier: "value" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.value, [...path, String(propertyNameOrSymbol), "[[descriptor:value]]"]) : undefined
    };
  };

  const computeMethodDescriptionArray = (value, path) => {
    const methodDescriptionArray = [];

    if (typeof Set === "function" && value instanceof Set) {
      const callArray = [];
      value.forEach((entryValue, index) => {
        const entryValueIdentifier = valueToIdentifier(entryValue, [...path, `[[SetEntryValue]]`, index]);
        callArray.push([entryValueIdentifier]);
      });
      methodDescriptionArray.push({
        methodNameIdentifier: valueToIdentifier("add"),
        callArray
      });
    }

    if (typeof Map === "function" && value instanceof Map) {
      const callArray = [];
      value.forEach((entryValue, entryKey) => {
        const entryKeyIdentifier = valueToIdentifier(entryKey, [...path, "[[MapEntryKey]]", entryKey]);
        const entryValueIdentifier = valueToIdentifier(entryValue, [...path, "[[MapEntryValue]]", entryValue]);
        callArray.push([entryKeyIdentifier, entryValueIdentifier]);
      });
      methodDescriptionArray.push({
        methodNameIdentifier: valueToIdentifier("set"),
        callArray
      });
    }

    return methodDescriptionArray;
  };

  const identifierForPrimitive = value => {
    return Object.keys(valueMap).find(existingIdentifier => {
      const existingValue = valueMap[existingIdentifier];
      if (Object.is(value, existingValue)) return true;
      return value === existingValue;
    });
  };

  const identifierForComposite = value => {
    return Object.keys(valueMap).find(existingIdentifier => {
      const existingValue = valueMap[existingIdentifier];
      return value === existingValue;
    });
  };

  const identifierForNewValue = value => {
    const identifier = nextIdentifier();
    valueMap[identifier] = value;
    return identifier;
  };

  let currentIdentifier = -1;

  const nextIdentifier = () => {
    const identifier = String(parseInt(currentIdentifier) + 1);
    currentIdentifier = identifier;
    return identifier;
  };

  const mainIdentifier = valueToIdentifier(mainValue); // prototype, important to keep after the whole structure was visited
  // so that we discover if any prototype is part of the value

  const prototypeValueToIdentifier = prototypeValue => {
    // prototype is null
    if (prototypeValue === null) return valueToIdentifier(prototypeValue); // prototype found somewhere already

    const prototypeExistingIdentifier = identifierForComposite(prototypeValue);
    if (prototypeExistingIdentifier !== undefined) return prototypeExistingIdentifier; // mark prototype as visited

    const prototypeIdentifier = identifierForNewValue(prototypeValue); // prototype is a global reference ?

    const prototypeGlobalPath = getCompositeGlobalPath(prototypeValue);

    if (prototypeGlobalPath) {
      recipeArray[prototypeIdentifier] = createGlobalReferenceRecipe(prototypeGlobalPath);
      return prototypeIdentifier;
    } // otherwise prototype is unknown


    if (prototypeStrict) {
      throw new Error(createUnknownPrototypeMessage({
        prototypeValue
      }));
    }

    return prototypeValueToIdentifier(Object.getPrototypeOf(prototypeValue));
  };

  const identifierForValueOf = (value, path = []) => {
    if (value instanceof Array) return valueToIdentifier(value.length, [...path, "length"]);
    if ("valueOf" in value === false) return undefined;
    if (typeof value.valueOf !== "function") return undefined;
    const valueOfReturnValue = value.valueOf();
    if (!isComposite(valueOfReturnValue)) return valueToIdentifier(valueOfReturnValue, [...path, "valueOf()"]);
    if (valueOfReturnValue === value) return undefined;
    throw new Error(createUnexpectedValueOfReturnValueMessage());
  };

  recipeArray.slice().forEach((recipe, index) => {
    if (recipe.type === "composite") {
      const value = valueMap[index];

      if (typeof value === "function") {
        const valueOfIdentifier = nextIdentifier();
        recipeArray[valueOfIdentifier] = {
          type: "primitive",
          value
        };
        recipe.valueOfIdentifier = valueOfIdentifier;
        return;
      }

      if (value instanceof RegExp) {
        const valueOfIdentifier = nextIdentifier();
        recipeArray[valueOfIdentifier] = {
          type: "primitive",
          value
        };
        recipe.valueOfIdentifier = valueOfIdentifier;
        return;
      } // valueOf, mandatory to uneval new Date(10) for instance.


      recipe.valueOfIdentifier = identifierForValueOf(value);
      const prototypeValue = Object.getPrototypeOf(value);
      recipe.prototypeIdentifier = prototypeValueToIdentifier(prototypeValue);
    }
  });
  return {
    recipeArray,
    mainIdentifier,
    valueMap
  };
};

const primitiveToRecipe = value => {
  if (typeof value === "symbol") return symbolToRecipe(value);
  return createPimitiveRecipe(value);
};

const symbolToRecipe = symbol => {
  const globalSymbolKey = Symbol.keyFor(symbol);
  if (globalSymbolKey !== undefined) return createGlobalSymbolRecipe(globalSymbolKey);
  const symbolGlobalPath = getPrimitiveGlobalPath(symbol);
  if (!symbolGlobalPath) throw new Error(createUnknownSymbolMessage({
    symbol
  }));
  return createGlobalReferenceRecipe(symbolGlobalPath);
};

const createPimitiveRecipe = value => {
  return {
    type: "primitive",
    value
  };
};

const createGlobalReferenceRecipe = path => {
  const recipe = {
    type: "global-reference",
    path
  };
  return recipe;
};

const createGlobalSymbolRecipe = key => {
  return {
    type: "global-symbol",
    key
  };
};

const createCompositeRecipe = ({
  prototypeIdentifier,
  valueOfIdentifier,
  propertyDescriptionArray,
  symbolDescriptionArray,
  methodDescriptionArray,
  extensible
}) => {
  return {
    type: "composite",
    prototypeIdentifier,
    valueOfIdentifier,
    propertyDescriptionArray,
    symbolDescriptionArray,
    methodDescriptionArray,
    extensible
  };
};

const createPromiseAreNotSupportedMessage = ({
  path
}) => {
  if (path.length === 0) return `promise are not supported.`;
  return `promise are not supported.
promise found at: ${path.join("")}`;
};

const createWeakSetAreNotSupportedMessage = ({
  path
}) => {
  if (path.length === 0) return `weakSet are not supported.`;
  return `weakSet are not supported.
weakSet found at: ${path.join("")}`;
};

const createWeakMapAreNotSupportedMessage = ({
  path
}) => {
  if (path.length === 0) return `weakMap are not supported.`;
  return `weakMap are not supported.
weakMap found at: ${path.join("")}`;
};

const createForbiddenFunctionMessage = ({
  path
}) => {
  if (path.length === 0) return `function are not allowed.`;
  return `function are not allowed.
function found at: ${path.join("")}`;
};

const createForbiddenPropertyGetterMessage = ({
  path,
  propertyNameOrSymbol
}) => `property getter are not allowed.
getter found on property: ${String(propertyNameOrSymbol)}
at: ${path.join("")}`;

const createForbiddenPropertySetterMessage = ({
  path,
  propertyNameOrSymbol
}) => `property setter are not allowed.
setter found on property: ${String(propertyNameOrSymbol)}
at: ${path.join("")}`;

const createUnexpectedValueOfReturnValueMessage = () => `valueOf() must return a primitive of the object itself.`;

const createUnknownSymbolMessage = ({
  symbol
}) => `symbol must be global, like Symbol.iterator, or created using Symbol.for().
symbol: ${symbol.toString()}`;

const createUnknownPrototypeMessage = ({
  prototypeValue
}) => `prototype must be global, like Object.prototype, or somewhere in the value.
prototype constructor name: ${prototypeValue.constructor.name}`;

// be carefull because this function is mutating recipe objects inside the recipeArray.
// this is not an issue because each recipe object is not accessible from the outside
// when used internally by uneval
const sortRecipe = recipeArray => {
  const findInRecipePrototypeChain = (recipe, callback) => {
    let currentRecipe = recipe; // eslint-disable-next-line no-constant-condition

    while (true) {
      if (currentRecipe.type !== "composite") break;
      const prototypeIdentifier = currentRecipe.prototypeIdentifier;
      if (prototypeIdentifier === undefined) break;
      currentRecipe = recipeArray[prototypeIdentifier];
      if (callback(currentRecipe, prototypeIdentifier)) return prototypeIdentifier;
    }

    return undefined;
  };

  const recipeArrayOrdered = recipeArray.slice();
  recipeArrayOrdered.sort((leftRecipe, rightRecipe) => {
    const leftType = leftRecipe.type;
    const rightType = rightRecipe.type;

    if (leftType === "composite" && rightType === "composite") {
      const rightRecipeIsInLeftRecipePrototypeChain = findInRecipePrototypeChain(leftRecipe, recipeCandidate => recipeCandidate === rightRecipe); // if left recipe requires right recipe, left must be after right

      if (rightRecipeIsInLeftRecipePrototypeChain) return 1;
      const leftRecipeIsInRightRecipePrototypeChain = findInRecipePrototypeChain(rightRecipe, recipeCandidate => recipeCandidate === leftRecipe); // if right recipe requires left recipe, right must be after left

      if (leftRecipeIsInRightRecipePrototypeChain) return -1;
    }

    if (leftType !== rightType) {
      // if left is a composite, left must be after right
      if (leftType === "composite") return 1; // if right is a composite, right must be after left

      if (rightType === "composite") return -1;
    }

    const leftIndex = recipeArray.indexOf(leftRecipe);
    const rightIndex = recipeArray.indexOf(rightRecipe); // left was before right, don't change that

    if (leftIndex < rightIndex) return -1; // right was after left, don't change that

    return 1;
  });
  return recipeArrayOrdered;
};

// https://github.com/joliss/js-string-escape/blob/master/index.js
// http://javascript.crockford.com/remedial.html
const escapeString = value => {
  const string = String(value);
  let i = 0;
  const j = string.length;
  var escapedString = "";

  while (i < j) {
    const char = string[i];
    let escapedChar;

    if (char === '"' || char === "'" || char === "\\") {
      escapedChar = `\\${char}`;
    } else if (char === "\n") {
      escapedChar = "\\n";
    } else if (char === "\r") {
      escapedChar = "\\r";
    } else if (char === "\u2028") {
      escapedChar = "\\u2028";
    } else if (char === "\u2029") {
      escapedChar = "\\u2029";
    } else {
      escapedChar = char;
    }

    escapedString += escapedChar;
    i++;
  }

  return escapedString;
};

const uneval = (value, {
  functionAllowed = false,
  prototypeStrict = false
} = {}) => {
  const {
    recipeArray,
    mainIdentifier,
    valueMap
  } = decompose(value, {
    functionAllowed,
    prototypeStrict
  });
  const recipeArraySorted = sortRecipe(recipeArray);
  let source = `(function () {
Object.defineProperty(Object.prototype, "__global__", {
  get: function () { return this },
  configurable: true,
});
var globalObject = __global__;
delete Object.prototype.__global__;

function safeDefineProperty(object, propertyNameOrSymbol, descriptor) {
  var currentDescriptor = Object.getOwnPropertyDescriptor(object, propertyNameOrSymbol);
  if (currentDescriptor && !currentDescriptor.configurable) return
  Object.defineProperty(object, propertyNameOrSymbol, descriptor)
};
`;
  const variableNameMap = {};
  recipeArray.forEach((recipe, index) => {
    const indexSorted = recipeArraySorted.indexOf(recipe);
    variableNameMap[index] = `_${indexSorted}`;
  });

  const identifierToVariableName = identifier => variableNameMap[identifier];

  const recipeToSetupSource = recipe => {
    if (recipe.type === "primitive") return primitiveRecipeToSetupSource(recipe);
    if (recipe.type === "global-symbol") return globalSymbolRecipeToSetupSource(recipe);
    if (recipe.type === "global-reference") return globalReferenceRecipeToSetupSource(recipe);
    return compositeRecipeToSetupSource(recipe);
  };

  const primitiveRecipeToSetupSource = ({
    value
  }) => {
    if (typeof value === "string") return `"${escapeString(value)}";`;
    if (Object.is(value, -0)) return "-0;";
    return `${String(value)};`;
  };

  const globalSymbolRecipeToSetupSource = recipe => {
    return `Symbol.for("${escapeString(recipe.key)}");`;
  };

  const globalReferenceRecipeToSetupSource = recipe => {
    const pathSource = recipe.path.map(part => `["${escapeString(part)}"]`).join("");
    return `globalObject${pathSource};`;
  };

  const compositeRecipeToSetupSource = ({
    prototypeIdentifier,
    valueOfIdentifier
  }) => {
    if (prototypeIdentifier === undefined) return identifierToVariableName(valueOfIdentifier);
    const prototypeValue = valueMap[prototypeIdentifier];
    if (prototypeValue === null) return `Object.create(null);`;
    const prototypeConstructor = prototypeValue.constructor;
    if (prototypeConstructor === Object) return `Object.create(${identifierToVariableName(prototypeIdentifier)});`;
    if (valueOfIdentifier === undefined) return `new ${prototypeConstructor.name}();`;
    return `new ${prototypeConstructor.name}(${identifierToVariableName(valueOfIdentifier)});`;
  };

  recipeArraySorted.forEach(recipe => {
    const recipeVariableName = identifierToVariableName(recipeArray.indexOf(recipe));
    source += `var ${recipeVariableName} = ${recipeToSetupSource(recipe)}
`;
  });

  const recipeToMutateSource = (recipe, recipeVariableName) => {
    if (recipe.type === "composite") return compositeRecipeToMutateSource(recipe, recipeVariableName);
    return ``;
  };

  const compositeRecipeToMutateSource = ({
    propertyDescriptionArray,
    symbolDescriptionArray,
    methodDescriptionArray,
    extensible
  }, recipeVariableName) => {
    let mutateSource = ``;
    propertyDescriptionArray.forEach(({
      propertyNameIdentifier,
      propertyDescription
    }) => {
      mutateSource += generateDefinePropertySource(recipeVariableName, propertyNameIdentifier, propertyDescription);
    });
    symbolDescriptionArray.forEach(({
      symbolIdentifier,
      propertyDescription
    }) => {
      mutateSource += generateDefinePropertySource(recipeVariableName, symbolIdentifier, propertyDescription);
    });
    methodDescriptionArray.forEach(({
      methodNameIdentifier,
      callArray
    }) => {
      mutateSource += generateMethodCallSource(recipeVariableName, methodNameIdentifier, callArray);
    });

    if (!extensible) {
      mutateSource += generatePreventExtensionSource(recipeVariableName);
    }

    return mutateSource;
  };

  const generateDefinePropertySource = (recipeVariableName, propertyNameOrSymbolIdentifier, propertyDescription) => {
    const propertyOrSymbolVariableName = identifierToVariableName(propertyNameOrSymbolIdentifier);
    const propertyDescriptorSource = generatePropertyDescriptorSource(propertyDescription);
    return `safeDefineProperty(${recipeVariableName}, ${propertyOrSymbolVariableName}, ${propertyDescriptorSource});`;
  };

  const generatePropertyDescriptorSource = ({
    configurable,
    writable,
    enumerable,
    getIdentifier,
    setIdentifier,
    valueIdentifier
  }) => {
    if (valueIdentifier === undefined) {
      return `{
  configurable: ${configurable},
  enumerable: ${enumerable},
  get: ${getIdentifier === undefined ? undefined : identifierToVariableName(getIdentifier)},
  set: ${setIdentifier === undefined ? undefined : identifierToVariableName(setIdentifier)},
}`;
    }

    return `{
  configurable: ${configurable},
  writable: ${writable},
  enumerable: ${enumerable},
  value: ${valueIdentifier === undefined ? undefined : identifierToVariableName(valueIdentifier)}
}`;
  };

  const generateMethodCallSource = (recipeVariableName, methodNameIdentifier, callArray) => {
    let methodCallSource = ``;
    const methodVariableName = identifierToVariableName(methodNameIdentifier);
    callArray.forEach(argumentIdentifiers => {
      const argumentVariableNames = argumentIdentifiers.map(argumentIdentifier => identifierToVariableName(argumentIdentifier));
      methodCallSource += `${recipeVariableName}[${methodVariableName}](${argumentVariableNames.join(",")});`;
    });
    return methodCallSource;
  };

  const generatePreventExtensionSource = recipeVariableName => {
    return `Object.preventExtensions(${recipeVariableName});`;
  };

  recipeArraySorted.forEach(recipe => {
    const recipeVariableName = identifierToVariableName(recipeArray.indexOf(recipe));
    source += `${recipeToMutateSource(recipe, recipeVariableName)}`;
  });
  source += `return ${identifierToVariableName(mainIdentifier)}; })()`;
  return source;
};

const AVAILABLE_DEBUG_MODE = ["none", "inherit", "inspect", "inspect-brk", "debug", "debug-brk"];
const createChildExecArgv = async ({
  cancellationToken = createCancellationToken(),
  // https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_automatically-attach-debugger-to-nodejs-subprocesses
  debugPort,
  debugMode,
  debugModeInheritBreak,
  processExecArgv,
  processDebugPort
} = {}) => {
  if (typeof debugMode === "string" && AVAILABLE_DEBUG_MODE.indexOf(debugMode) === -1) {
    throw new TypeError(`unexpected debug mode.
--- debug mode ---
${debugMode}
--- allowed debug mode ---
${AVAILABLE_DEBUG_MODE}`);
  }

  const processDebug = parseDebugFromExecArgv(processExecArgv); // this is required because vscode does not
  // support assigning a child spwaned without a specific port

  const forceFreePortIfZero = async ({
    debugPort,
    port
  }) => {
    if (debugPort === 0) {
      const freePort = await findFreePort((port === 0 ? processDebugPort : port) + 1, {
        cancellationToken
      });
      return freePort;
    }

    return debugPort;
  };

  if (debugMode === "inherit") {
    if (processDebug.mode === "none") {
      return copyExecArgv(processExecArgv);
    }

    const childDebugPort = await forceFreePortIfZero({
      cancellationToken,
      debugPort,
      port: processDebug.port
    });
    let {
      mode
    } = processDebug;

    if (debugModeInheritBreak === false) {
      if (mode === "debug-brk") mode = "debug";
      if (mode === "inspect-brk") mode = "inspect";
    }

    return replaceDebugExecArgv(processExecArgv, {
      processDebug,
      mode,
      port: childDebugPort
    });
  }

  if (debugMode !== "none") {
    if (processDebug.mode === "none") {
      const childDebugPort = await forceFreePortIfZero({
        cancellationToken,
        debugPort,
        port: 1000 // TODO: should be random from 0 to 10000 for instance

      });
      return addDebugExecArgv(processExecArgv, {
        mode: debugMode,
        port: childDebugPort
      });
    }

    const childDebugPort = await forceFreePortIfZero({
      cancellationToken,
      debugPort,
      port: processDebug.port
    });
    return replaceDebugExecArgv(processExecArgv, {
      processDebug,
      mode: debugMode,
      port: childDebugPort
    });
  }

  if (processDebug.mode === "none") {
    return copyExecArgv(processExecArgv);
  }

  return removeDebugExecArgv(processExecArgv, processDebug);
};

const copyExecArgv = argv => argv.slice();

const replaceDebugExecArgv = (argv, {
  processDebug,
  mode,
  port
}) => {
  const argvCopy = argv.slice();

  if (processDebug.portIndex) {
    // argvCopy[modeIndex] = `--${mode}`
    argvCopy[processDebug.portIndex] = `--${mode}-port${portToPortSuffix(port)}`;
    return argvCopy;
  }

  argvCopy[processDebug.modeIndex] = `--${mode}${portToPortSuffix(port)}`;
  return argvCopy;
};

const addDebugExecArgv = (argv, {
  mode,
  port
}) => {
  const argvCopy = argv.slice();
  argvCopy.push(`--${mode}${portToPortSuffix(port)}`);
  return argvCopy;
};

const removeDebugExecArgv = (argv, {
  modeIndex,
  portIndex
}) => {
  const argvCopy = argv.slice();

  if (portIndex > -1) {
    argvCopy.splice(portIndex, 1);
    argvCopy.splice( // if modeIndex is after portIndex do -1 because we spliced
    // portIndex just above
    modeIndex > portIndex ? modeIndex - 1 : modeIndex, 1);
    return argvCopy;
  }

  argvCopy.splice(modeIndex);
  return argvCopy;
};

const portToPortSuffix = port => {
  if (typeof port !== "number") return "";
  if (port === 0) return "";
  return `=${port}`;
};

const parseDebugFromExecArgv = argv => {
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i]; // https://nodejs.org/en/docs/guides/debugging-getting-started/

    if (arg === "--inspect") {
      return {
        mode: "inspect",
        modeIndex: i,
        ...parseInspectPortFromExecArgv(argv)
      };
    }

    const inspectPortMatch = /^--inspect=([0-9]+)$/.exec(arg);

    if (inspectPortMatch) {
      return {
        mode: "inspect",
        modeIndex: i,
        port: Number(inspectPortMatch[1])
      };
    }

    if (arg === "--inspect-brk") {
      return {
        // force "inspect" otherwise a breakpoint is hit inside vscode
        // mode: "inspect",
        mode: "inspect-brk",
        modeIndex: i,
        ...parseInspectPortFromExecArgv(argv)
      };
    }

    const inspectBreakMatch = /^--inspect-brk=([0-9]+)$/.exec(arg);

    if (inspectBreakMatch) {
      return {
        // force "inspect" otherwise a breakpoint is hit inside vscode
        // mode: "inspect",
        mode: "inspect-brk",
        modeIndex: i,
        port: Number(inspectBreakMatch[1])
      };
    }

    if (arg === "--debug") {
      return {
        mode: "debug",
        modeIndex: i,
        ...parseDebugPortFromExecArgv(argv)
      };
    }

    const debugPortMatch = /^--debug=([0-9]+)$/.exec(arg);

    if (debugPortMatch) {
      return {
        mode: "debug",
        modeIndex: i,
        port: Number(debugPortMatch[1])
      };
    }

    if (arg === "--debug-brk") {
      return {
        mode: "debug-brk",
        modeIndex: i,
        ...parseDebugPortFromExecArgv(argv)
      };
    }

    const debugBreakMatch = /^--debug-brk=([0-9]+)$/.exec(arg);

    if (debugBreakMatch) {
      return {
        mode: "debug-brk",
        modeIndex: i,
        port: Number(debugBreakMatch[1])
      };
    }

    i++;
  }

  return {
    mode: "none"
  };
};

const parseInspectPortFromExecArgv = argv => {
  const portMatch = arrayFindMatch(argv, arg => {
    if (arg === "--inspect-port") return {
      port: 0
    };
    const match = /^--inspect-port=([0-9]+)$/.exec(arg);
    if (match) return {
      port: Number(match[1])
    };
    return null;
  });

  if (portMatch) {
    return {
      port: portMatch.port,
      portIndex: portMatch.arrayIndex
    };
  }

  return {
    port: 0
  };
};

const parseDebugPortFromExecArgv = argv => {
  const portMatch = arrayFindMatch(argv, arg => {
    if (arg === "--debug-port") return {
      port: 0
    };
    const match = /^--debug-port=([0-9]+)$/.exec(arg);
    if (match) return {
      port: Number(match[1])
    };
    return null;
  });

  if (portMatch) {
    return {
      port: portMatch.port,
      portIndex: portMatch.arrayIndex
    };
  }

  return {
    port: 0
  };
};

const arrayFindMatch = (array, match) => {
  let i = 0;

  while (i < array.length) {
    const value = array[i];
    i++;
    const matchResult = match(value);

    if (matchResult) {
      return { ...matchResult,
        arrayIndex: i
      };
    }
  }

  return null;
};

const fetch$2 = nodeRequire("node-fetch");

const AbortController$1 = nodeRequire("abort-controller"); // ideally we should only pass this to the fetch below


https.globalAgent.options.rejectUnauthorized = false;
const fetchUsingHttp$1 = async (url, {
  cancellationToken,
  ...rest
} = {}) => {
  if (cancellationToken) {
    // a cancelled fetch will never resolve, while cancellation api
    // expect to get a rejected promise.
    // createOperation ensure we'll get a promise rejected with a cancelError
    const response = await createOperation({
      cancellationToken,
      start: () => fetch$2(url, {
        signal: cancellationTokenToAbortSignal$1(cancellationToken),
        ...rest
      })
    });
    return normalizeResponse$1(response);
  }

  const response = await fetch$2(url, rest);
  return normalizeResponse$1(response);
};

const normalizeResponse$1 = async response => {
  const text = await response.text();
  return {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: responseToHeaderMap$1(response),
    body: text
  };
}; // https://github.com/bitinn/node-fetch#request-cancellation-with-abortsignal


const cancellationTokenToAbortSignal$1 = cancellationToken => {
  const abortController = new AbortController$1();
  cancellationToken.register(reason => {
    abortController.abort(reason);
  });
  return abortController.signal;
};

const responseToHeaderMap$1 = response => {
  const headerMap = {};
  response.headers.forEach((value, name) => {
    headerMap[name] = value;
  });
  return headerMap;
};

/* eslint-disable import/max-dependencies */
const EVALUATION_STATUS_OK = "evaluation-ok";
const launchNode = async ({
  cancellationToken = createCancellationToken(),
  // logger,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  debugPort = 0,
  debugMode = "inherit",
  debugModeInheritBreak = true,
  remap = true,
  traceWarnings = true,
  collectCoverage = false,
  env
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`);
  }

  if (typeof outDirectoryRelativeUrl !== "string") {
    throw new TypeError(`outDirectoryRelativeUrl must be a string, got ${outDirectoryRelativeUrl}`);
  }

  if (env === undefined) {
    env = { ...process.env
    };
  } else if (typeof env !== "object") {
    throw new TypeError(`env must be an object, got ${env}`);
  }

  const nodeControllableFileUrl = resolveUrl$1("./src/internal/node-launcher/nodeControllableFile.js", jsenvCoreDirectoryUrl);
  await assertFileExists(nodeControllableFileUrl);
  const execArgv = await createChildExecArgv({
    cancellationToken,
    debugPort,
    debugMode,
    debugModeInheritBreak,
    processExecArgv: process.execArgv,
    processDebugPort: process.debugPort
  });

  if (traceWarnings && !execArgv.includes("--trace-warnings")) {
    execArgv.push("--trace-warnings");
  }

  env.COVERAGE_ENABLED = collectCoverage;
  const child = child_process.fork(fileUrlToPath(nodeControllableFileUrl), {
    execArgv,
    // silent: true
    stdio: "pipe",
    env
  });
  const consoleCallbackArray = [];

  const registerConsoleCallback = callback => {
    consoleCallbackArray.push(callback);
  }; // beware that we may receive ansi output here, should not be a problem but keep that in mind


  child.stdout.on("data", chunk => {
    const text = String(chunk);
    consoleCallbackArray.forEach(callback => {
      callback({
        type: "log",
        text
      });
    });
  });
  child.stderr.on("data", chunk => {
    const text = String(chunk);
    consoleCallbackArray.forEach(callback => {
      callback({
        type: "error",
        text
      });
    });
  });
  const errorCallbackArray = [];

  const registerErrorCallback = callback => {
    errorCallbackArray.push(callback);
  };

  const emitError = error => {
    errorCallbackArray.forEach(callback => {
      callback(error);
    });
  }; // https://nodejs.org/api/child_process.html#child_process_event_error


  const errorEventRegistration = registerChildEvent(child, "error", error => {
    errorEventRegistration.unregister();
    exitErrorRegistration.unregister();
    emitError(error);
  }); // process.exit(1) from child

  const exitErrorRegistration = registerChildEvent(child, "exit", code => {
    if (code !== 0 && code !== null) {
      errorEventRegistration.unregister();
      exitErrorRegistration.unregister();
      emitError(createExitWithFailureCodeError(code));
    }
  }); // https://nodejs.org/api/child_process.html#child_process_event_disconnect

  const registerDisconnectCallback = callback => {
    const registration = registerChildEvent(child, "disconnect", () => {
      callback();
    });
    return () => {
      registration.unregister();
    };
  };

  const stop = () => {
    const disconnectedPromise = new Promise(resolve => {
      const unregister = registerDisconnectCallback(() => {
        unregister();
        resolve();
      });
    });
    child.kill("SIGINT");
    return disconnectedPromise;
  };

  const stopForce = () => {
    const disconnectedPromise = new Promise(resolve => {
      const unregister = registerDisconnectCallback(() => {
        unregister();
        resolve();
      });
    });
    child.kill();
    return disconnectedPromise;
  };

  const executeFile = async (fileRelativeUrl, {
    collectNamespace,
    collectCoverage,
    executionId
  }) => {
    const execute = async () => {
      const nodeJsFileUrl = resolveUrl$1("./src/internal/node-launcher/node-js-file.js", jsenvCoreDirectoryUrl);
      const nodeJsFileRelativeUrl = urlToRelativeUrl(nodeJsFileUrl, projectDirectoryUrl);
      const nodeBundledJsFileRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_COMMONJS_BUNDLE}/${nodeJsFileRelativeUrl}`;
      const nodeBundledJsFileUrl = `${projectDirectoryUrl}${nodeBundledJsFileRelativeUrl}`;
      const nodeBundledJsFileRemoteUrl = `${compileServerOrigin}/${nodeBundledJsFileRelativeUrl}`;
      await fetchUsingHttp$1(nodeBundledJsFileRemoteUrl, {
        cancellationToken
      });
      return new Promise((resolve, reject) => {
        const evaluationResultRegistration = registerChildMessage(child, "evaluate-result", ({
          status,
          value
        }) => {
          evaluationResultRegistration.unregister();
          if (status === EVALUATION_STATUS_OK) resolve(value);else reject(value);
        });
        sendToChild(child, "evaluate", createNodeIIFEString({
          nodeExecuteFileUrl: nodeBundledJsFileUrl,
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          fileRelativeUrl,
          compileServerOrigin,
          collectNamespace,
          collectCoverage,
          executionId,
          remap
        }));
      });
    };

    const executionResult = await execute();
    const {
      status
    } = executionResult;

    if (status === "errored") {
      const {
        exceptionSource,
        coverageMap
      } = executionResult;
      return {
        status,
        error: evalException$1(exceptionSource, {
          compileServerOrigin,
          projectDirectoryUrl
        }),
        coverageMap
      };
    }

    const {
      namespace,
      coverageMap
    } = executionResult;
    return {
      status,
      namespace,
      coverageMap
    };
  };

  return {
    name: "node",
    version: process.version.slice(1),
    options: {
      execArgv,
      env
    },
    stop,
    stopForce,
    registerDisconnectCallback,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile
  };
};

const evalException$1 = (exceptionSource, {
  compileServerOrigin,
  projectDirectoryUrl
}) => {
  const error = evalSource$1(exceptionSource);

  if (error && error instanceof Error) {
    const compileServerOriginRegexp = new RegExp(escapeRegexpSpecialCharacters(`${compileServerOrigin}/`), "g");
    const projectDirectoryPath = fileUrlToPath(projectDirectoryUrl);
    error.stack = error.stack.replace(compileServerOriginRegexp, projectDirectoryPath);
    error.message = error.message.replace(compileServerOriginRegexp, projectDirectoryPath);
    const projectDirectoryPathRegexp = new RegExp(`(?<!file:\/\/)${escapeRegexpSpecialCharacters(projectDirectoryPath)}`, "g");
    error.stack = error.stack.replace(projectDirectoryPathRegexp, projectDirectoryUrl);
    error.message = error.message.replace(projectDirectoryPathRegexp, projectDirectoryUrl);
  }

  return error;
};

const sendToChild = (child, type, data) => {
  const source = uneval(data, {
    functionAllowed: true
  });
  child.send({
    type,
    data: source
  });
};

const registerChildMessage = (child, type, callback) => {
  return registerChildEvent(child, "message", message => {
    if (message.type === type) {
      // eslint-disable-next-line no-eval
      callback(eval(`(${message.data})`));
    }
  });
};

const registerChildEvent = (child, type, callback) => {
  child.on(type, callback);

  const unregister = () => {
    child.removeListener(type, callback);
  };

  const registration = {
    unregister
  };
  return registration;
};

const createExitWithFailureCodeError = code => {
  if (code === 12) {
    return new Error(`child exited with 12: forked child wanted to use a non available port for debug`);
  }

  return new Error(`child exited with ${code}`);
};

const createNodeIIFEString = ({
  nodeExecuteFileUrl,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  compileServerOrigin,
  collectNamespace,
  collectCoverage,
  executionId,
  remap
}) => `(() => {
  const { execute } = require(${JSON.stringify(fileUrlToPath(nodeExecuteFileUrl))})

  return execute(${JSON.stringify({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  compileServerOrigin,
  collectNamespace,
  collectCoverage,
  executionId,
  remap
}, null, "    ")})
})()`;

const evalSource$1 = (code, href) => {
  const script = new vm.Script(code, {
    filename: href
  });
  return script.runInThisContext();
};

const serveExploringIndex = async ({
  projectDirectoryUrl,
  htmlFileUrl,
  explorableConfig
}) => {
  const htmlFileRelativeUrl = urlToRelativeUrl(htmlFileUrl, projectDirectoryUrl);
  const specifierMetaMap = metaMapToSpecifierMetaMap({
    explorable: explorableConfig
  });
  const matchingFileResultArray = await collectFiles({
    directoryPath: projectDirectoryUrl,
    specifierMetaMap,
    predicate: ({
      explorable
    }) => explorable
  });
  const explorableRelativeUrlArray = matchingFileResultArray.map(({
    relativePath
  }) => relativePath);
  const html = getBrowsingIndexPageHTML({
    projectDirectoryUrl,
    htmlFileRelativeUrl,
    explorableRelativeUrlArray
  });
  return {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html",
      "content-length": Buffer.byteLength(html)
    },
    body: html
  };
};

const getBrowsingIndexPageHTML = ({
  projectDirectoryUrl,
  htmlFileRelativeUrl,
  explorableRelativeUrlArray
}) => {
  return `<!doctype html>

  <head>
    <title>Exploring ${projectDirectoryUrl}</title>
    <meta charset="utf-8" />
  </head>

  <body>
    <main>
      <h1>${projectDirectoryUrl}</h1>
      <p>List of path to explore: </p>
      <ul>
        ${explorableRelativeUrlArray.map(relativeUrl => `<li><a href="${htmlFileRelativeUrl}?file=${relativeUrl}">${relativeUrl}</a></li>`).join("")}
      </ul>
    </main>
  </body>
  </html>`;
};

const serveBrowserSelfExecute = async ({
  cancellationToken,
  logger,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  compileServerImportMap,
  importDefaultExtension,
  projectFileRequestedCallback,
  request,
  babelPluginMap
}) => {
  const browserSelfExecuteTemplateFileUrl = resolveUrl$1("./src/internal/exploring/browserSelfExecuteTemplate.js", jsenvCoreDirectoryUrl);
  const browserSelfExecuteDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}browser-self-execute/`;
  const browserSelfExecuteDirectoryRemoteUrl = resolveDirectoryUrl(browserSelfExecuteDirectoryRelativeUrl, request.origin);
  return firstService(() => {
    const {
      ressource,
      headers,
      origin
    } = request; // "/.jsenv/browser-script.js" is written inside htmlFile

    if (ressource === "/.jsenv/browser-script.js") {
      const file = new URL(headers.referer).searchParams.get("file");
      const browserSelfExecuteCompiledFileRemoteUrl = `${origin}/${browserSelfExecuteDirectoryRelativeUrl}${file}`;
      return {
        status: 307,
        headers: {
          location: browserSelfExecuteCompiledFileRemoteUrl
        }
      };
    }

    return null;
  }, () => {
    // dynamic data exists only to retrieve the compile server origin
    // that can be dynamic
    // otherwise the cached bundles would still target the previous compile server origin
    if (request.ressource === `/${jsenvDirectoryRelativeUrl}browser-self-execute-dynamic-data.json`) {
      const body = JSON.stringify({
        compileServerOrigin
      });
      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body)
        },
        body
      };
    }

    return null;
  }, () => {
    const {
      origin,
      ressource,
      method,
      headers
    } = request;
    const requestUrl = `${origin}${ressource}`;

    if (urlIsAsset(requestUrl)) {
      return serveFile(`${projectDirectoryUrl}${ressource.slice(1)}`, {
        method,
        headers
      });
    }

    if (requestUrl.startsWith(browserSelfExecuteDirectoryRemoteUrl)) {
      const originalFileUrl = browserSelfExecuteTemplateFileUrl;
      const compiledFileUrl = `${projectDirectoryUrl}${ressource.slice(1)}`;
      return serveBundle({
        cancellationToken,
        logger,
        jsenvProjectDirectoryUrl: jsenvCoreDirectoryUrl,
        projectDirectoryUrl,
        originalFileUrl,
        compiledFileUrl,
        outDirectoryRelativeUrl,
        compileServerOrigin,
        compileServerImportMap,
        importDefaultExtension,
        format: "global",
        projectFileRequestedCallback,
        request,
        babelPluginMap
      });
    }

    return null;
  });
};

const jsenvExplorableConfig = {
  "./index.js": true,
  "./src/**/*.js": true,
  "./test/**/*.js": true
};

const startExploring = async ({
  cancellationToken = createCancellationTokenForProcessSIGINT(),
  logLevel,
  compileServerLogLevel = logLevel,
  htmlFileUrl = jsenvHtmlFileUrl,
  explorableConfig = jsenvExplorableConfig,
  watchConfig = {
    "./**/*": true,
    "./.git/": false,
    "./node_modules/": false
  },
  livereloading = false,
  projectDirectoryPath,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  babelPluginMap,
  convertMap,
  compileGroupCount = 2,
  keepProcessAlive = true,
  cors = true,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  forcePort = false,
  certificate,
  privateKey
}) => {
  const logger = createLogger({
    logLevel
  });
  assertProjectDirectoryPath({
    projectDirectoryPath
  });
  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath);
  await assertProjectDirectoryExists({
    projectDirectoryUrl
  });
  await assertFileExists(htmlFileUrl);
  const stopExploringCancellationSource = createCancellationSource();
  cancellationToken = composeCancellationToken(cancellationToken, stopExploringCancellationSource.token);
  return catchAsyncFunctionCancellation(async () => {
    let livereloadServerSentEventService = () => {
      return {
        status: 204
      };
    };

    let rawProjectFileRequestedCallback = () => {};

    let projectFileRequestedCallback = () => {};

    const compileServer = await startCompileServer({
      cancellationToken,
      compileServerLogLevel,
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      importMapFileRelativeUrl,
      importDefaultExtension,
      compileGroupCount,
      babelPluginMap,
      convertMap,
      cors,
      protocol,
      privateKey,
      certificate,
      ip,
      port: 0,
      // random available port
      forcePort: false,
      // no need because random port
      projectFileRequestedCallback: value => {
        // just to allow projectFileRequestedCallback to be redefined
        projectFileRequestedCallback(value);
      },
      stopOnPackageVersionChange: true,
      keepProcessAlive
    });
    const specifierMetaMapRelativeForExplorable = metaMapToSpecifierMetaMap({
      explorable: explorableConfig
    });
    const specifierMetaMapForExplorable = normalizeSpecifierMetaMap(specifierMetaMapRelativeForExplorable, projectDirectoryUrl);

    if (livereloading) {
      watchConfig[compileServer.jsenvDirectoryRelativeUrl] = false;
      const unregisterDirectoryLifecyle = registerDirectoryLifecycle(projectDirectoryPath, {
        watchDescription: watchConfig,
        updated: ({
          relativePath: relativeUrl
        }) => {
          if (projectFileSet.has(relativeUrl)) {
            projectFileUpdatedCallback(relativeUrl);
          }
        },
        removed: ({
          relativePath: relativeUrl
        }) => {
          if (projectFileSet.has(relativeUrl)) {
            projectFileSet.delete(relativeUrl);
            projectFileRemovedCallback(relativeUrl);
          }
        },
        keepProcessAlive: false
      });
      cancellationToken.register(unregisterDirectoryLifecyle);
      const projectFileSet = new Set();
      const roomMap = {};
      const dependencyTracker = {};

      const projectFileUpdatedCallback = relativeUrl => {
        projectFileToAffectedRoomArray(relativeUrl).forEach(room => {
          room.sendEvent({
            type: "file-changed",
            data: relativeUrl
          });
        });
      };

      const projectFileRemovedCallback = relativeUrl => {
        projectFileToAffectedRoomArray(relativeUrl).forEach(room => {
          room.sendEvent({
            type: "file-removed",
            data: relativeUrl
          });
        });
      };

      const projectFileToAffectedRoomArray = relativeUrl => {
        const affectedRoomArray = [];
        Object.keys(roomMap).forEach(mainRelativeUrl => {
          if (!dependencyTracker.hasOwnProperty(mainRelativeUrl)) return;

          if (relativeUrl === mainRelativeUrl || dependencyTracker[mainRelativeUrl].includes(relativeUrl)) {
            affectedRoomArray.push(roomMap[mainRelativeUrl]);
          }
        });
        return affectedRoomArray;
      };

      const trackDependency = ({
        relativeUrl,
        executionId
      }) => {
        if (executionId) {
          // quand on voit main on marque tout ce qui existe actuallement
          // comme plus dépendant ?
          // mais si ce qui était la
          if (dependencyTracker.hasOwnProperty(executionId)) {
            const dependencyArray = dependencyTracker[executionId];

            if (!dependencyArray.includes(dependencyTracker)) {
              dependencyArray.push(relativeUrl);
            }
          } else {
            dependencyTracker[executionId] = [relativeUrl];
          }
        } else {
          Object.keys(dependencyTracker).forEach(executionId => {
            trackDependency({
              relativeUrl,
              executionId
            });
          });
        }
      };

      projectFileRequestedCallback = ({
        relativeUrl,
        request
      }) => {
        projectFileSet.add(relativeUrl);
        const {
          headers = {}
        } = request;

        if ("x-jsenv-execution-id" in headers) {
          const executionId = headers["x-jsenv-execution-id"];
          trackDependency({
            relativeUrl,
            executionId
          });
        } else if ("referer" in headers) {
          const {
            referer
          } = headers;

          if (sameOrigin(referer, request.origin)) {
            const refererRelativeUrl = referer.slice(`${request.origin}/`.length);
            const refererFileUrl = `${projectDirectoryUrl}${refererRelativeUrl}`;

            if (urlToMeta({
              url: refererFileUrl,
              specifierMetaMap: specifierMetaMapForExplorable
            }).explorable) {
              const executionId = refererRelativeUrl;
              trackDependency({
                relativeUrl,
                executionId
              });
            } else {
              Object.keys(dependencyTracker).forEach(executionId => {
                if (executionId === refererRelativeUrl || dependencyTracker[executionId].includes(refererRelativeUrl)) {
                  trackDependency({
                    relativeUrl,
                    executionId
                  });
                }
              });
            }
          } else {
            trackDependency({
              relativeUrl
            });
          }
        } else {
          trackDependency({
            relativeUrl
          });
        }
      };

      rawProjectFileRequestedCallback = ({
        relativeUrl,
        request
      }) => {
        // when it's the html file used to execute the files
        if (relativeUrl === urlToRelativeUrl(htmlFileUrl, projectDirectoryUrl)) {
          dependencyTracker[relativeUrl] = [];
        } else {
          projectFileRequestedCallback({
            relativeUrl,
            request
          });
          projectFileSet.add(relativeUrl);
        }
      };

      livereloadServerSentEventService = ({
        request: {
          ressource,
          headers
        }
      }) => {
        return getOrCreateRoomForRelativeUrl(ressource.slice(1)).connect(headers["last-event-id"]);
      };

      const getOrCreateRoomForRelativeUrl = relativeUrl => {
        if (roomMap.hasOwnProperty(relativeUrl)) return roomMap[relativeUrl];
        const room = createSSERoom();
        room.start();
        cancellationToken.register(room.stop);
        roomMap[relativeUrl] = room;
        return room;
      };
    }

    const {
      origin: compileServerOrigin,
      compileServerImportMap,
      outDirectoryRelativeUrl,
      jsenvDirectoryRelativeUrl: compileServerJsenvDirectoryRelativeUrl
    } = compileServer;

    const service = request => firstService(() => {
      const {
        accept = ""
      } = request.headers;

      if (accept.includes("text/event-stream")) {
        return livereloadServerSentEventService({
          request
        });
      }

      return null;
    }, () => {
      if (request.ressource.startsWith("/node_modules/source-map/")) {
        const specifier = request.ressource.slice("/node_modules/".length);

        const filePath = nodeRequire.resolve(specifier);

        return serveFile(filePath, {
          method: request.method,
          headers: request.headers
        });
      }

      return null;
    }, () => {
      if (request.ressource === "/") {
        return serveExploringIndex({
          projectDirectoryUrl,
          htmlFileUrl,
          explorableConfig,
          request
        });
      }

      return null;
    }, () => {
      return serveBrowserSelfExecute({
        cancellationToken,
        logger,
        projectDirectoryUrl,
        jsenvDirectoryRelativeUrl: compileServerJsenvDirectoryRelativeUrl,
        outDirectoryRelativeUrl,
        compileServerOrigin,
        compileServerImportMap,
        importDefaultExtension,
        projectFileRequestedCallback,
        request,
        babelPluginMap
      });
    }, () => {
      const relativeUrl = request.ressource.slice(1);
      const fileUrl = `${projectDirectoryUrl}${relativeUrl}`;
      rawProjectFileRequestedCallback({
        relativeUrl,
        request
      });
      return serveFile(fileUrl, {
        method: request.method,
        headers: request.headers,
        cacheStrategy: "etag"
      });
    });

    const browserServer = await startServer({
      cancellationToken,
      logLevel,
      protocol,
      privateKey,
      certificate,
      ip,
      port,
      forcePort,
      sendInternalErrorStack: true,
      requestToResponse: service,
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
      keepProcessAlive
    });
    compileServer.stoppedPromise.then(reason => {
      browserServer.stop(reason);
    }, () => {});
    browserServer.stoppedPromise.then(reason => {
      stopExploringCancellationSource.cancel(reason);
    });
    return { ...browserServer,
      compileServerOrigin
    };
  });
};

exports.convertCommonJsWithBabel = convertCommonJsWithBabel;
exports.convertCommonJsWithRollup = convertCommonJsWithRollup;
exports.execute = execute;
exports.executeTestPlan = executeTestPlan;
exports.generateCommonJsBundle = generateCommonJsBundle;
exports.generateCommonJsBundleForNode = generateCommonJsBundleForNode;
exports.generateGlobalBundle = generateGlobalBundle;
exports.generateSystemJsBundle = generateSystemJsBundle;
exports.jsenvBabelPluginCompatMap = jsenvBabelPluginCompatMap;
exports.jsenvBabelPluginMap = jsenvBabelPluginMap;
exports.jsenvBrowserScoreMap = jsenvBrowserScoreMap;
exports.jsenvNodeVersionScoreMap = jsenvNodeVersionScoreMap;
exports.jsenvPluginCompatMap = jsenvPluginCompatMap;
exports.launchChromium = launchChromium;
exports.launchChromiumTab = launchChromiumTab;
exports.launchNode = launchNode;
exports.startExploring = startExploring;
//# sourceMappingURL=main.js.map
