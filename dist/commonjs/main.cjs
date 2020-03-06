'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

function _interopNamespace(e) {
  if (e && e.__esModule) { return e; } else {
    var n = {};
    if (e) {
      Object.keys(e).forEach(function (k) {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () {
            return e[k];
          }
        });
      });
    }
    n['default'] = e;
    return n;
  }
}

var module$1 = require('module');
var url$1 = require('url');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var util = require('util');
var https = require('https');
var net = require('net');
var http = require('http');
var stream = require('stream');
var os = require('os');
var readline = _interopDefault(require('readline'));
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

const urlToScheme = urlString => {
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) return "";
  return urlString.slice(0, colonIndex);
};

const urlToPathname = urlString => {
  return ressourceToPathname(urlToRessource(urlString));
};

const urlToRessource = urlString => {
  const scheme = urlToScheme(urlString);

  if (scheme === "file") {
    return urlString.slice("file://".length);
  }

  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = urlString.slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    return afterProtocol.slice(pathnameSlashIndex);
  }

  return urlString.slice(scheme.length + 1);
};

const ressourceToPathname = ressource => {
  const searchSeparatorIndex = ressource.indexOf("?");
  return searchSeparatorIndex === -1 ? ressource : ressource.slice(0, searchSeparatorIndex);
};

const urlToOrigin = urlString => {
  const scheme = urlToScheme(urlString);

  if (scheme === "file") {
    return "file://";
  }

  if (scheme === "http" || scheme === "https") {
    const secondProtocolSlashIndex = scheme.length + "://".length;
    const pathnameSlashIndex = urlString.indexOf("/", secondProtocolSlashIndex);
    if (pathnameSlashIndex === -1) return urlString;
    return urlString.slice(0, pathnameSlashIndex);
  }

  return urlString.slice(0, scheme.length + 1);
};

const pathnameToDirectoryPathname = pathname => {
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
    return `${urlToScheme(baseUrl)}:${specifier}`;
  } // origin relative


  if (specifier[0] === "/") {
    return `${urlToOrigin(baseUrl)}${specifier}`;
  }

  const baseOrigin = urlToOrigin(baseUrl);
  const basePathname = urlToPathname(baseUrl);

  if (specifier === ".") {
    const baseDirectoryPathname = pathnameToDirectoryPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}/`;
  } // pathname relative inside


  if (specifier.slice(0, 2) === "./") {
    const baseDirectoryPathname = pathnameToDirectoryPathname(basePathname);
    return `${baseOrigin}${baseDirectoryPathname}/${specifier.slice(2)}`;
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

  return `${baseOrigin}${pathnameToDirectoryPathname(basePathname)}/${specifier}`;
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
  if (urlToPathname(url).endsWith("/")) {
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
      const importerPathname = urlToPathname(importer);
      const importerExtension = pathnameToExtension(importerPathname);
      return `${url}${importerExtension}`;
    }
  }

  return url;
};

/* global require, __filename */
const nodeRequire = require;
const filenameContainsBackSlashes = __filename.indexOf("\\") > -1;
const url = filenameContainsBackSlashes ? `file:///${__filename.replace(/\\/g, "/")}` : `file://${__filename}`;

const require$1 = module$1.createRequire(url);

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
  return thirdChar === "/" || thirdChar === "\\";
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
      if (remainingString[0] === "/") {
        return pass({
          patternIndex: patternIndex + 1,
          index: string.length
        });
      }

      return fail({
        patternIndex,
        index
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

const assertSpecifierMetaMap = (value, checkComposition = true) => {
  if (!isPlainObject(value)) {
    throw new TypeError(`specifierMetaMap must be a plain object, got ${value}`);
  }

  if (checkComposition) {
    const plainObject = value;
    Object.keys(plainObject).forEach(key => {
      assertUrlLike(key, "specifierMetaMap key");
      const value = plainObject[key];

      if (value !== null && !isPlainObject(value)) {
        throw new TypeError(`specifierMetaMap value must be a plain object or null, got ${value} under key ${key}`);
      }
    });
  }
};

const normalizeSpecifierMetaMap = (specifierMetaMap, url, ...rest) => {
  assertSpecifierMetaMap(specifierMetaMap, false);
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

const ensureUrlTrailingSlash = url => {
  return url.endsWith("/") ? url : `${url}/`;
};

const isFileSystemPath = value => {
  if (typeof value !== "string") {
    throw new TypeError(`isFileSystemPath first arg must be a string, got ${value}`);
  }

  if (value[0] === "/") return true;
  return startsWithWindowsDriveLetter(value);
};

const startsWithWindowsDriveLetter = string => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = string[1];
  if (secondChar !== ":") return false;
  return true;
};

const fileSystemPathToUrl = value => {
  if (!isFileSystemPath(value)) {
    throw new Error(`received an invalid value for fileSystemPath: ${value}`);
  }

  return String(url$1.pathToFileURL(value));
};

const assertAndNormalizeDirectoryUrl = value => {
  let urlString;

  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      urlString = fileSystemPathToUrl(value);
    } else {
      try {
        urlString = String(new URL(value));
      } catch (e) {
        throw new TypeError(`directoryUrl must be a valid url, received ${value}`);
      }
    }
  } else {
    throw new TypeError(`directoryUrl must be a string or an url, received ${value}`);
  }

  if (!urlString.startsWith("file://")) {
    throw new Error(`directoryUrl must starts with file://, received ${value}`);
  }

  return ensureUrlTrailingSlash(urlString);
};

const assertAndNormalizeFileUrl = (value, baseUrl) => {
  let urlString;

  if (value instanceof URL) {
    urlString = value.href;
  } else if (typeof value === "string") {
    if (isFileSystemPath(value)) {
      urlString = fileSystemPathToUrl(value);
    } else {
      try {
        urlString = String(new URL(value, baseUrl));
      } catch (e) {
        throw new TypeError(`fileUrl must be a valid url, received ${value}`);
      }
    }
  } else {
    throw new TypeError(`fileUrl must be a string or an url, received ${value}`);
  }

  if (!urlString.startsWith("file://")) {
    throw new Error(`fileUrl must starts with file://, received ${value}`);
  }

  return urlString;
};

const statsToType = stats => {
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  if (stats.isSymbolicLink()) return "symbolic-link";
  if (stats.isFIFO()) return "fifo";
  if (stats.isSocket()) return "socket";
  if (stats.isCharacterDevice()) return "character-device";
  if (stats.isBlockDevice()) return "block-device";
  return undefined;
};

const urlToFileSystemPath = fileUrl => {
  if (fileUrl[fileUrl.length - 1] === "/") {
    // remove trailing / so that nodejs path becomes predictable otherwise it logs
    // the trailing slash on linux but does not on windows
    fileUrl = fileUrl.slice(0, -1);
  }

  const fileSystemPath = url$1.fileURLToPath(fileUrl);
  return fileSystemPath;
};

// https://github.com/coderaiser/cloudcmd/issues/63#issuecomment-195478143
// https://nodejs.org/api/fs.html#fs_file_modes
// https://github.com/TooTallNate/stat-mode
// cannot get from fs.constants because they are not available on windows
const S_IRUSR = 256;
/* 0000400 read permission, owner */

const S_IWUSR = 128;
/* 0000200 write permission, owner */

const S_IXUSR = 64;
/* 0000100 execute/search permission, owner */

const S_IRGRP = 32;
/* 0000040 read permission, group */

const S_IWGRP = 16;
/* 0000020 write permission, group */

const S_IXGRP = 8;
/* 0000010 execute/search permission, group */

const S_IROTH = 4;
/* 0000004 read permission, others */

const S_IWOTH = 2;
/* 0000002 write permission, others */

const S_IXOTH = 1;
const permissionsToBinaryFlags = ({
  owner,
  group,
  others
}) => {
  let binaryFlags = 0;
  if (owner.read) binaryFlags |= S_IRUSR;
  if (owner.write) binaryFlags |= S_IWUSR;
  if (owner.execute) binaryFlags |= S_IXUSR;
  if (group.read) binaryFlags |= S_IRGRP;
  if (group.write) binaryFlags |= S_IWGRP;
  if (group.execute) binaryFlags |= S_IXGRP;
  if (others.read) binaryFlags |= S_IROTH;
  if (others.write) binaryFlags |= S_IWOTH;
  if (others.execute) binaryFlags |= S_IXOTH;
  return binaryFlags;
};

const writeFileSystemNodePermissions = async (source, permissions) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const sourcePath = urlToFileSystemPath(sourceUrl);
  let binaryFlags;

  if (typeof permissions === "object") {
    permissions = {
      owner: {
        read: getPermissionOrComputeDefault("read", "owner", permissions),
        write: getPermissionOrComputeDefault("write", "owner", permissions),
        execute: getPermissionOrComputeDefault("execute", "owner", permissions)
      },
      group: {
        read: getPermissionOrComputeDefault("read", "group", permissions),
        write: getPermissionOrComputeDefault("write", "group", permissions),
        execute: getPermissionOrComputeDefault("execute", "group", permissions)
      },
      others: {
        read: getPermissionOrComputeDefault("read", "others", permissions),
        write: getPermissionOrComputeDefault("write", "others", permissions),
        execute: getPermissionOrComputeDefault("execute", "others", permissions)
      }
    };
    binaryFlags = permissionsToBinaryFlags(permissions);
  } else {
    binaryFlags = permissions;
  }

  return chmodNaive(sourcePath, binaryFlags);
};

const chmodNaive = (fileSystemPath, binaryFlags) => {
  return new Promise((resolve, reject) => {
    fs.chmod(fileSystemPath, binaryFlags, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const actionLevels = {
  read: 0,
  write: 1,
  execute: 2
};
const subjectLevels = {
  others: 0,
  group: 1,
  owner: 2
};

const getPermissionOrComputeDefault = (action, subject, permissions) => {
  if (subject in permissions) {
    const subjectPermissions = permissions[subject];

    if (action in subjectPermissions) {
      return subjectPermissions[action];
    }

    const actionLevel = actionLevels[action];
    const actionFallback = Object.keys(actionLevels).find(actionFallbackCandidate => actionLevels[actionFallbackCandidate] > actionLevel && actionFallbackCandidate in subjectPermissions);

    if (actionFallback) {
      return subjectPermissions[actionFallback];
    }
  }

  const subjectLevel = subjectLevels[subject]; // do we have a subject with a stronger level (group or owner)
  // where we could read the action permission ?

  const subjectFallback = Object.keys(subjectLevels).find(subjectFallbackCandidate => subjectLevels[subjectFallbackCandidate] > subjectLevel && subjectFallbackCandidate in permissions);

  if (subjectFallback) {
    const subjectPermissions = permissions[subjectFallback];
    return action in subjectPermissions ? subjectPermissions[action] : getPermissionOrComputeDefault(action, subjectFallback, permissions);
  }

  return false;
};

const isWindows = process.platform === "win32";
const readFileSystemNodeStat = async (source, {
  nullIfNotFound = false,
  followLink = true
} = {}) => {
  if (source.endsWith("/")) source = source.slice(0, -1);
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const sourcePath = urlToFileSystemPath(sourceUrl);
  const handleNotFoundOption = nullIfNotFound ? {
    handleNotFoundError: () => null
  } : {};
  return readStat(sourcePath, {
    followLink,
    ...handleNotFoundOption,
    ...(isWindows ? {
      // Windows can EPERM on stat
      handlePermissionDeniedError: async error => {
        // unfortunately it means we mutate the permissions
        // without being able to restore them to the previous value
        // (because reading current permission would also throw)
        try {
          await writeFileSystemNodePermissions(sourceUrl, 0o666);
          const stats = await readStat(sourcePath, {
            followLink,
            ...handleNotFoundOption,
            // could not fix the permission error, give up and throw original error
            handlePermissionDeniedError: () => {
              throw error;
            }
          });
          return stats;
        } catch (e) {
          // failed to write permission or readState, throw original error as well
          throw error;
        }
      }
    } : {})
  });
};

const readStat = (sourcePath, {
  followLink,
  handleNotFoundError = null,
  handlePermissionDeniedError = null
} = {}) => {
  const nodeMethod = followLink ? fs.stat : fs.lstat;
  return new Promise((resolve, reject) => {
    nodeMethod(sourcePath, (error, statsObject) => {
      if (error) {
        if (handlePermissionDeniedError && (error.code === "EPERM" || error.code === "EACCES")) {
          resolve(handlePermissionDeniedError(error));
        } else if (handleNotFoundError && error.code === "ENOENT") {
          resolve(handleNotFoundError(error));
        } else {
          reject(error);
        }
      } else {
        resolve(statsObject);
      }
    });
  });
};

const assertDirectoryPresence = async source => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const sourcePath = urlToFileSystemPath(sourceUrl);
  const sourceStats = await readFileSystemNodeStat(sourceUrl, {
    nullIfNotFound: true
  });

  if (!sourceStats) {
    throw new Error(`directory not found at ${sourcePath}`);
  }

  if (!sourceStats.isDirectory()) {
    throw new Error(`directory expected at ${sourcePath} and found ${statsToType(sourceStats)} instead`);
  }
};

const assertFilePresence = async source => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const sourcePath = urlToFileSystemPath(sourceUrl);
  const sourceStats = await readFileSystemNodeStat(sourceUrl, {
    nullIfNotFound: true
  });

  if (!sourceStats) {
    throw new Error(`file not found at ${sourcePath}`);
  }

  if (!sourceStats.isFile()) {
    throw new Error(`file expected at ${sourcePath} and found ${statsToType(sourceStats)} instead`);
  }
};

const ETAG_FOR_EMPTY_CONTENT = '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
const bufferToEtag = buffer => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(`buffer expected, got ${buffer}`);
  }

  if (buffer.length === 0) {
    return ETAG_FOR_EMPTY_CONTENT;
  }

  const hash = crypto.createHash("sha1");
  hash.update(buffer, "utf8");
  const hashBase64String = hash.digest("base64");
  const hashBase64StringSubset = hashBase64String.slice(0, 27);
  const length = buffer.length;
  return `"${length.toString(16)}-${hashBase64StringSubset}"`;
};

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

const catchCancellation = asyncFn => {
  return asyncFn().catch(error => {
    if (isCancelError(error)) {
      // it means consume of the function will resolve with a cancelError
      // but when you cancel it means you're not interested in the result anymore
      // thanks to this it avoid unhandledRejection
      return error;
    }

    throw error;
  });
};

const readDirectory = async (url, {
  emfileMaxWait = 1000
} = {}) => {
  const directoryUrl = assertAndNormalizeDirectoryUrl(url);
  const directoryPath = urlToFileSystemPath(directoryUrl);
  const startMs = Date.now();
  let attemptCount = 0;

  const attempt = () => {
    return readdirNaive(directoryPath, {
      handleTooManyFilesOpenedError: async error => {
        attemptCount++;
        const nowMs = Date.now();
        const timeSpentWaiting = nowMs - startMs;

        if (timeSpentWaiting > emfileMaxWait) {
          throw error;
        }

        return new Promise(resolve => {
          setTimeout(() => {
            resolve(attempt());
          }, attemptCount);
        });
      }
    });
  };

  return attempt();
};

const readdirNaive = (directoryPath, {
  handleTooManyFilesOpenedError = null
} = {}) => {
  return new Promise((resolve, reject) => {
    fs.readdir(directoryPath, (error, names) => {
      if (error) {
        // https://nodejs.org/dist/latest-v13.x/docs/api/errors.html#errors_common_system_errors
        if (handleTooManyFilesOpenedError && (error.code === "EMFILE" || error.code === "ENFILE")) {
          resolve(handleTooManyFilesOpenedError(error));
        } else {
          reject(error);
        }
      } else {
        resolve(names);
      }
    });
  });
};

const getCommonPathname = (pathname, otherPathname) => {
  const firstDifferentCharacterIndex = findFirstDifferentCharacterIndex(pathname, otherPathname); // pathname and otherpathname are exactly the same

  if (firstDifferentCharacterIndex === -1) {
    return pathname;
  }

  const commonString = pathname.slice(0, firstDifferentCharacterIndex + 1); // the first different char is at firstDifferentCharacterIndex

  if (pathname.charAt(firstDifferentCharacterIndex) === "/") {
    return commonString;
  }

  if (otherPathname.charAt(firstDifferentCharacterIndex) === "/") {
    return commonString;
  }

  const firstDifferentSlashIndex = commonString.lastIndexOf("/");
  return pathname.slice(0, firstDifferentSlashIndex + 1);
};

const findFirstDifferentCharacterIndex = (string, otherString) => {
  const maxCommonLength = Math.min(string.length, otherString.length);
  let i = 0;

  while (i < maxCommonLength) {
    const char = string.charAt(i);
    const otherChar = otherString.charAt(i);

    if (char !== otherChar) {
      return i;
    }

    i++;
  }

  if (string.length === otherString.length) {
    return -1;
  } // they differ at maxCommonLength


  return maxCommonLength;
};

const pathnameToDirectoryPathname$1 = pathname => {
  if (pathname.endsWith("/")) {
    return pathname;
  }

  const slashLastIndex = pathname.lastIndexOf("/");

  if (slashLastIndex === -1) {
    return "";
  }

  return pathname.slice(0, slashLastIndex + 1);
};

const urlToRelativeUrl = (urlArg, baseUrlArg) => {
  const url = new URL(urlArg);
  const baseUrl = new URL(baseUrlArg);

  if (url.protocol !== baseUrl.protocol) {
    return urlArg;
  }

  if (url.username !== baseUrl.username || url.password !== baseUrl.password) {
    return urlArg.slice(url.protocol.length);
  }

  if (url.host !== baseUrl.host) {
    return urlArg.slice(url.protocol.length);
  }

  const {
    pathname,
    hash,
    search
  } = url;

  if (pathname === "/") {
    return baseUrl.pathname.slice(1);
  }

  const {
    pathname: basePathname
  } = baseUrl;
  const commonPathname = getCommonPathname(pathname, basePathname);

  if (!commonPathname) {
    return urlArg;
  }

  const specificPathname = pathname.slice(commonPathname.length);
  const baseSpecificPathname = basePathname.slice(commonPathname.length);
  const baseSpecificDirectoryPathname = pathnameToDirectoryPathname$1(baseSpecificPathname);
  const relativeDirectoriesNotation = baseSpecificDirectoryPathname.replace(/.*?\//g, "../");
  const relativePathname = `${relativeDirectoriesNotation}${specificPathname}`;
  return `${relativePathname}${search}${hash}`;
};

const comparePathnames = (leftPathame, rightPathname) => {
  const leftPartArray = leftPathame.split("/");
  const rightPartArray = rightPathname.split("/");
  const leftLength = leftPartArray.length;
  const rightLength = rightPartArray.length;
  const maxLength = Math.max(leftLength, rightLength);
  let i = 0;

  while (i < maxLength) {
    const leftPartExists = i in leftPartArray;
    const rightPartExists = i in rightPartArray; // longer comes first

    if (!leftPartExists) return +1;
    if (!rightPartExists) return -1;
    const leftPartIsLast = i === leftPartArray.length - 1;
    const rightPartIsLast = i === rightPartArray.length - 1; // folder comes first

    if (leftPartIsLast && !rightPartIsLast) return +1;
    if (!leftPartIsLast && rightPartIsLast) return -1;
    const leftPart = leftPartArray[i];
    const rightPart = rightPartArray[i];
    i++; // local comparison comes first

    const comparison = leftPart.localeCompare(rightPart);
    if (comparison !== 0) return comparison;
  }

  if (leftLength < rightLength) return +1;
  if (leftLength > rightLength) return -1;
  return 0;
};

const collectFiles = async ({
  cancellationToken = createCancellationToken(),
  directoryUrl,
  specifierMetaMap,
  predicate,
  matchingFileOperation = () => null
}) => {
  const rootDirectoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);

  if (typeof predicate !== "function") {
    throw new TypeError(`predicate must be a function, got ${predicate}`);
  }

  if (typeof matchingFileOperation !== "function") {
    throw new TypeError(`matchingFileOperation must be a function, got ${matchingFileOperation}`);
  }

  const specifierMetaMapNormalized = normalizeSpecifierMetaMap(specifierMetaMap, rootDirectoryUrl);
  const matchingFileResultArray = [];

  const visitDirectory = async directoryUrl => {
    const directoryItems = await createOperation({
      cancellationToken,
      start: () => readDirectory(directoryUrl)
    });
    await Promise.all(directoryItems.map(async directoryItem => {
      const directoryChildNodeUrl = `${directoryUrl}${directoryItem}`;
      const directoryChildNodeStats = await createOperation({
        cancellationToken,
        start: () => readFileSystemNodeStat(directoryChildNodeUrl, {
          // we ignore symlink because recursively traversed
          // so symlinked file will be discovered.
          // Moreover if they lead outside of directoryPath it can become a problem
          // like infinite recursion of whatever.
          // that we could handle using an object of pathname already seen but it will be useless
          // because directoryPath is recursively traversed
          followLink: false
        })
      });

      if (directoryChildNodeStats.isDirectory()) {
        const subDirectoryUrl = `${directoryChildNodeUrl}/`;

        if (!urlCanContainsMetaMatching({
          url: subDirectoryUrl,
          specifierMetaMap: specifierMetaMapNormalized,
          predicate
        })) {
          return;
        }

        await visitDirectory(subDirectoryUrl);
        return;
      }

      if (directoryChildNodeStats.isFile()) {
        const meta = urlToMeta({
          url: directoryChildNodeUrl,
          specifierMetaMap: specifierMetaMapNormalized
        });
        if (!predicate(meta)) return;
        const relativeUrl = urlToRelativeUrl(directoryChildNodeUrl, rootDirectoryUrl);
        const operationResult = await createOperation({
          cancellationToken,
          start: () => matchingFileOperation({
            cancellationToken,
            relativeUrl,
            meta,
            fileStats: directoryChildNodeStats
          })
        });
        matchingFileResultArray.push({
          relativeUrl,
          meta,
          fileStats: directoryChildNodeStats,
          operationResult
        });
        return;
      }
    }));
  };

  await visitDirectory(rootDirectoryUrl); // When we operate on thoose files later it feels more natural
  // to perform operation in the same order they appear in the filesystem.
  // It also allow to get a predictable return value.
  // For that reason we sort matchingFileResultArray

  matchingFileResultArray.sort((leftFile, rightFile) => {
    return comparePathnames(leftFile.relativeUrl, rightFile.relativeUrl);
  });
  return matchingFileResultArray;
};

const {
  mkdir
} = fs.promises;
const writeDirectory = async (destination, {
  recursive = true,
  allowUseless = false
} = {}) => {
  const destinationUrl = assertAndNormalizeDirectoryUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);
  const destinationStats = await readFileSystemNodeStat(destinationUrl, {
    nullIfNotFound: true,
    followLink: false
  });

  if (destinationStats) {
    if (destinationStats.isDirectory()) {
      if (allowUseless) {
        return;
      }

      throw new Error(`directory already exists at ${destinationPath}`);
    }

    const destinationType = statsToType(destinationStats);
    throw new Error(`cannot write directory at ${destinationPath} because there is a ${destinationType}`);
  }

  try {
    await mkdir(destinationPath, {
      recursive
    });
  } catch (error) {
    if (allowUseless && error.code === "EEXIST") {
      return;
    }

    throw error;
  }
};

const resolveUrl$1 = (specifier, baseUrl) => {
  if (typeof baseUrl === "undefined") {
    throw new TypeError(`baseUrl missing to resolve ${specifier}`);
  }

  return String(new URL(specifier, baseUrl));
};

const removeFileSystemNode = async (source, {
  allowUseless = false,
  recursive = false,
  maxRetries = 3,
  retryDelay = 100,
  onlyContent = false
} = {}) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const sourceStats = await readFileSystemNodeStat(sourceUrl, {
    nullIfNotFound: true,
    followLink: false
  });

  if (!sourceStats) {
    if (allowUseless) {
      return;
    }

    throw new Error(`nothing to remove at ${urlToFileSystemPath(sourceUrl)}`);
  } // https://nodejs.org/dist/latest-v13.x/docs/api/fs.html#fs_class_fs_stats
  // FIFO and socket are ignored, not sure what they are exactly and what to do with them
  // other libraries ignore them, let's do the same.


  if (sourceStats.isFile() || sourceStats.isSymbolicLink() || sourceStats.isCharacterDevice() || sourceStats.isBlockDevice()) {
    await removeNonDirectory(sourceUrl.endsWith("/") ? sourceUrl.slice(0, -1) : sourceUrl, {
      maxRetries,
      retryDelay
    });
  } else if (sourceStats.isDirectory()) {
    await removeDirectory(ensureUrlTrailingSlash(sourceUrl), {
      recursive,
      maxRetries,
      retryDelay,
      onlyContent
    });
  }
};

const removeNonDirectory = (sourceUrl, {
  maxRetries,
  retryDelay
}) => {
  const sourcePath = urlToFileSystemPath(sourceUrl);
  let retryCount = 0;

  const attempt = () => {
    return unlinkNaive(sourcePath, { ...(retryCount >= maxRetries ? {} : {
        handleTemporaryError: async () => {
          retryCount++;
          return new Promise(resolve => {
            setTimeout(() => {
              resolve(attempt());
            }, retryCount * retryDelay);
          });
        }
      })
    });
  };

  return attempt();
};

const unlinkNaive = (sourcePath, {
  handleTemporaryError = null
} = {}) => {
  return new Promise((resolve, reject) => {
    fs.unlink(sourcePath, error => {
      if (error) {
        if (error.code === "ENOENT") {
          resolve();
        } else if (handleTemporaryError && (error.code === "EBUSY" || error.code === "EMFILE" || error.code === "ENFILE" || error.code === "ENOENT")) {
          resolve(handleTemporaryError(error));
        } else {
          reject(error);
        }
      } else {
        resolve();
      }
    });
  });
};

const removeDirectory = async (rootDirectoryUrl, {
  maxRetries,
  retryDelay,
  recursive,
  onlyContent
}) => {
  const visit = async sourceUrl => {
    const sourceStats = await readFileSystemNodeStat(sourceUrl, {
      nullIfNotFound: true,
      followLink: false
    }); // file/directory not found

    if (sourceStats === null) {
      return;
    }

    if (sourceStats.isFile() || sourceStats.isCharacterDevice() || sourceStats.isBlockDevice()) {
      await visitFile(sourceUrl);
    } else if (sourceStats.isSymbolicLink()) {
      await visitSymbolicLink(sourceUrl);
    } else if (sourceStats.isDirectory()) {
      await visitDirectory(`${sourceUrl}/`);
    }
  };

  const visitDirectory = async directoryUrl => {
    const directoryPath = urlToFileSystemPath(directoryUrl);
    const optionsFromRecursive = recursive ? {
      handleNotEmptyError: async () => {
        await removeDirectoryContent(directoryUrl);
        await visitDirectory(directoryUrl);
      }
    } : {};
    await removeDirectoryNaive(directoryPath, { ...optionsFromRecursive,
      // Workaround for https://github.com/joyent/node/issues/4337
      ...(process.platform === "win32" ? {
        handlePermissionError: async error => {
          let openOrCloseError;

          try {
            const fd = fs.openSync(directoryPath);
            fs.closeSync(fd);
          } catch (e) {
            openOrCloseError = e;
          }

          if (openOrCloseError) {
            if (openOrCloseError.code === "ENOENT") {
              return;
            }

            console.error(`error while trying to fix windows EPERM: ${openOrCloseError.stack}`);
            throw error;
          }

          await removeDirectoryNaive(directoryPath, { ...optionsFromRecursive
          });
        }
      } : {})
    });
  };

  const removeDirectoryContent = async directoryUrl => {
    const names = await readDirectory(directoryUrl);
    await Promise.all(names.map(async name => {
      const url = resolveUrl$1(name, directoryUrl);
      await visit(url);
    }));
  };

  const visitFile = async fileUrl => {
    await removeNonDirectory(fileUrl, {
      maxRetries,
      retryDelay
    });
  };

  const visitSymbolicLink = async symbolicLinkUrl => {
    await removeNonDirectory(symbolicLinkUrl, {
      maxRetries,
      retryDelay
    });
  };

  if (onlyContent) {
    await removeDirectoryContent(rootDirectoryUrl);
  } else {
    await visitDirectory(rootDirectoryUrl);
  }
};

const removeDirectoryNaive = (directoryPath, {
  handleNotEmptyError = null,
  handlePermissionError = null
} = {}) => {
  return new Promise((resolve, reject) => {
    fs.rmdir(directoryPath, (error, lstatObject) => {
      if (error) {
        if (handlePermissionError && error.code === "EPERM") {
          resolve(handlePermissionError(error));
        } else if (error.code === "ENOENT") {
          resolve();
        } else if (handleNotEmptyError && ( // linux os
        error.code === "ENOTEMPTY" || // SunOS
        error.code === "EEXIST")) {
          resolve(handleNotEmptyError(error));
        } else {
          reject(error);
        }
      } else {
        resolve(lstatObject);
      }
    });
  });
};

const ensureEmptyDirectory = async source => {
  const stats = await readFileSystemNodeStat(source, {
    nullIfNotFound: true,
    followLink: false
  });

  if (stats === null) {
    // if there is nothing, create a directory
    return writeDirectory(source);
  }

  if (stats.isDirectory()) {
    // if there is a directory remove its content and done
    return removeFileSystemNode(source, {
      allowUseless: true,
      recursive: true,
      onlyContent: true
    });
  }

  const sourceType = statsToType(stats);
  const sourcePath = urlToFileSystemPath(assertAndNormalizeFileUrl(source));
  throw new Error(`ensureEmptyDirectory expect directory at ${sourcePath}, found ${sourceType} instead`);
};

const isWindows$1 = process.platform === "win32";
const baseUrlFallback = fileSystemPathToUrl(process.cwd());
/**
 * Some url might be resolved or remapped to url without the windows drive letter.
 * For instance
 * new URL('/foo.js', 'file:///C:/dir/file.js')
 * resolves to
 * 'file:///foo.js'
 *
 * But on windows it becomes a problem because we need the drive letter otherwise
 * url cannot be converted to a filesystem path.
 *
 * ensureWindowsDriveLetter ensure a resolved url still contains the drive letter.
 */

const ensureWindowsDriveLetter = (url, baseUrl) => {
  try {
    url = String(new URL(url));
  } catch (e) {
    throw new Error(`absolute url expected but got ${url}`);
  }

  if (!isWindows$1) {
    return url;
  }

  try {
    baseUrl = String(new URL(baseUrl));
  } catch (e) {
    throw new Error(`absolute baseUrl expected but got ${baseUrl} to ensure windows drive letter on ${url}`);
  }

  if (!url.startsWith("file://")) {
    return url;
  }

  const afterProtocol = url.slice("file://".length); // we still have the windows drive letter

  if (extractDriveLetter(afterProtocol)) {
    return url;
  } // drive letter was lost, restore it


  const baseUrlOrFallback = baseUrl.startsWith("file://") ? baseUrl : baseUrlFallback;
  const driveLetter = extractDriveLetter(baseUrlOrFallback.slice("file://".length));

  if (!driveLetter) {
    throw new Error(`drive letter expected on baseUrl but got ${baseUrl} to ensure windows drive letter on ${url}`);
  }

  return `file:///${driveLetter}:${afterProtocol}`;
};

const extractDriveLetter = ressource => {
  // we still have the windows drive letter
  if (/[a-zA-Z]/.test(ressource[1]) && ressource[2] === ":") {
    return ressource[1];
  }

  return null;
};

const ensureParentDirectories = async destination => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);
  const destinationParentPath = path.dirname(destinationPath);
  return writeDirectory(destinationParentPath, {
    recursive: true,
    allowUseless: true
  });
};

const replaceBackSlashesWithSlashes = string => string.replace(/\\/g, "/");

const isWindows$2 = process.platform === "win32";

const urlIsInsideOf = (urlValue, otherUrlValue) => {
  const url = new URL(urlValue);
  const otherUrl = new URL(otherUrlValue);

  if (url.origin !== otherUrl.origin) {
    return false;
  }

  const urlPathname = url.pathname;
  const otherUrlPathname = otherUrl.pathname;

  if (urlPathname === otherUrlPathname) {
    return false;
  }

  return urlPathname.startsWith(otherUrlPathname);
};

const addCallback = callback => {
  const triggerHangUpOrDeath = () => callback(); // SIGHUP http://man7.org/linux/man-pages/man7/signal.7.html


  process.once("SIGUP", triggerHangUpOrDeath);
  return () => {
    process.removeListener("SIGUP", triggerHangUpOrDeath);
  };
};

const SIGUPSignal = {
  addCallback
};

const addCallback$1 = callback => {
  // SIGINT is CTRL+C from keyboard also refered as keyboard interruption
  // http://man7.org/linux/man-pages/man7/signal.7.html
  // may also be sent by vscode https://github.com/Microsoft/vscode-node-debug/issues/1#issuecomment-405185642
  process.once("SIGINT", callback);
  return () => {
    process.removeListener("SIGINT", callback);
  };
};

const SIGINTSignal = {
  addCallback: addCallback$1
};

const addCallback$2 = callback => {
  if (process.platform === "win32") {
    console.warn(`SIGTERM is not supported on windows`);
    return () => {};
  }

  const triggerTermination = () => callback(); // SIGTERM http://man7.org/linux/man-pages/man7/signal.7.html


  process.once("SIGTERM", triggerTermination);
  return () => {
    process.removeListener("SIGTERM", triggerTermination);
  };
};

const SIGTERMSignal = {
  addCallback: addCallback$2
};

let beforeExitCallbackArray = [];
let uninstall;

const addCallback$3 = callback => {
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
  addCallback: addCallback$3
};

const addCallback$4 = (callback, {
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
  addCallback: addCallback$4
};

const addCallback$5 = callback => {
  return eventRace({
    SIGHUP: {
      register: SIGUPSignal.addCallback,
      callback: () => callback("SIGHUP")
    },
    SIGINT: {
      register: SIGINTSignal.addCallback,
      callback: () => callback("SIGINT")
    },
    ...(process.platform === "win32" ? {} : {
      SIGTERM: {
        register: SIGTERMSignal.addCallback,
        callback: () => callback("SIGTERM")
      }
    }),
    beforeExit: {
      register: beforeExitSignal.addCallback,
      callback: () => callback("beforeExit")
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
  const callbackRecoverPromise = firstOperationMatching$1({
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

const createCancellationTokenForProcess = () => {
  const teardownCancelSource = createCancellationSource();
  teardownSignal.addCallback(reason => teardownCancelSource.cancel(`process ${reason}`));
  return teardownCancelSource.token;
};

const memoize = compute => {
  let memoized = false;
  let memoizedValue;

  const fnWithMemoization = (...args) => {
    if (memoized) {
      return memoizedValue;
    } // if compute is recursive wait for it to be fully done before storing the value
    // so set memoized boolean after the call


    memoizedValue = compute(...args);
    memoized = true;
    return memoizedValue;
  };

  fnWithMemoization.forget = () => {
    const value = memoizedValue;
    memoized = false;
    memoizedValue = undefined;
    return value;
  };

  return fnWithMemoization;
};

const readFilePromisified = util.promisify(fs.readFile);
const readFile = async value => {
  const fileUrl = assertAndNormalizeFileUrl(value);
  const filePath = urlToFileSystemPath(fileUrl);
  const buffer = await readFilePromisified(filePath);
  return buffer.toString();
};

const readFileSystemNodeModificationTime = async source => {
  const stats = await readFileSystemNodeStat(source);
  return Math.floor(stats.mtimeMs);
};

const fileSystemNodeToTypeOrNull = url => {
  const path = urlToFileSystemPath(url);

  try {
    const stats = fs.statSync(path);
    return statsToType(stats);
  } catch (e) {
    if (e.code === "ENOENT") {
      return null;
    }

    throw e;
  }
};

const isWindows$3 = process.platform === "win32";
const createWatcher = (sourcePath, options) => {
  const watcher = fs.watch(sourcePath, options);

  if (isWindows$3) {
    watcher.on("error", async error => {
      // https://github.com/joyent/node/issues/4337
      if (error.code === "EPERM") {
        try {
          const fd = fs.openSync(sourcePath, "r");
          fs.closeSync(fd);
        } catch (e) {
          if (e.code === "ENOENT") {
            return;
          }

          console.error(`error while fixing windows eperm: ${e.stack}`);
          throw error;
        }
      } else {
        throw error;
      }
    });
  }

  return watcher;
};

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

/* eslint-disable import/max-dependencies */
const isLinux = process.platform === "linux"; // linux does not support recursive option

const fsWatchSupportsRecursive = !isLinux;
const registerDirectoryLifecycle = (source, {
  added,
  updated,
  removed,
  watchDescription = {
    "./**/*": true
  },
  notifyExistent = false,
  keepProcessAlive = true,
  recursive = false
}) => {
  const sourceUrl = ensureUrlTrailingSlash(assertAndNormalizeFileUrl(source));

  if (!undefinedOrFunction(added)) {
    throw new TypeError(`added must be a function or undefined, got ${added}`);
  }

  if (!undefinedOrFunction(updated)) {
    throw new TypeError(`updated must be a function or undefined, got ${updated}`);
  }

  if (!undefinedOrFunction(removed)) {
    throw new TypeError(`removed must be a function or undefined, got ${removed}`);
  }

  const specifierMetaMap = normalizeSpecifierMetaMap(metaMapToSpecifierMetaMap({
    watch: watchDescription
  }), sourceUrl);

  const entryShouldBeWatched = ({
    relativeUrl,
    type
  }) => {
    const entryUrl = resolveUrl$1(relativeUrl, sourceUrl);

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

  const handleDirectoryEvent = ({
    directoryRelativeUrl,
    filename,
    eventType
  }) => {
    if (filename) {
      if (directoryRelativeUrl) {
        handleChange(`${directoryRelativeUrl}/${filename}`);
      } else {
        handleChange(`${filename}`);
      }
    } else if ((removed || added) && eventType === "rename") {
      // we might receive `rename` without filename
      // in that case we try to find ourselves which file was removed.
      let relativeUrlCandidateArray = Object.keys(contentMap);

      if (recursive && !fsWatchSupportsRecursive) {
        relativeUrlCandidateArray = relativeUrlCandidateArray.filter(relativeUrlCandidate => {
          if (!directoryRelativeUrl) {
            // ensure entry is top level
            if (relativeUrlCandidate.includes("/")) return false;
            return true;
          } // entry not inside this directory


          if (!relativeUrlCandidate.startsWith(directoryRelativeUrl)) return false;
          const afterDirectory = relativeUrlCandidate.slice(directoryRelativeUrl.length + 1); // deep inside this directory

          if (afterDirectory.includes("/")) return false;
          return true;
        });
      }

      const removedEntryRelativeUrl = relativeUrlCandidateArray.find(relativeUrlCandidate => {
        const entryUrl = resolveUrl$1(relativeUrlCandidate, sourceUrl);
        const type = fileSystemNodeToTypeOrNull(entryUrl);
        return type === null;
      });

      if (removedEntryRelativeUrl) {
        handleEntryLost({
          relativeUrl: removedEntryRelativeUrl,
          type: contentMap[removedEntryRelativeUrl]
        });
      }
    }
  };

  const handleChange = relativeUrl => {
    const entryUrl = resolveUrl$1(relativeUrl, sourceUrl);
    const previousType = contentMap[relativeUrl];
    const type = fileSystemNodeToTypeOrNull(entryUrl);

    if (!entryShouldBeWatched({
      relativeUrl,
      type
    })) {
      return;
    } // it's something new


    if (!previousType) {
      if (type !== null) {
        handleEntryFound({
          relativeUrl,
          type,
          existent: false
        });
      }

      return;
    } // it existed but now it's not here anymore


    if (type === null) {
      handleEntryLost({
        relativeUrl,
        type: previousType
      });
      return;
    } // it existed but was replaced by something else
    // it's not really an update


    if (previousType !== type) {
      handleEntryLost({
        relativeUrl,
        type: previousType
      });
      handleEntryFound({
        relativeUrl,
        type
      });
      return;
    } // a directory cannot really be updated in way that matters for us
    // filesystem is trying to tell us the directory content have changed
    // but we don't care about that
    // we'll already be notified about what has changed


    if (type === "directory") {
      return;
    } // right same type, and the file existed and was not deleted
    // it's likely an update ?
    // but are we sure it's an update ?


    if (updated) {
      updated({
        relativeUrl,
        type
      });
    }
  };

  const handleEntryFound = ({
    relativeUrl,
    type,
    existent
  }) => {
    if (!entryShouldBeWatched({
      relativeUrl,
      type
    })) {
      return;
    }

    contentMap[relativeUrl] = type;
    const entryUrl = resolveUrl$1(relativeUrl, sourceUrl);

    if (type === "directory") {
      visitDirectory({
        directoryUrl: `${entryUrl}/`,
        entryFound: entry => {
          handleEntryFound({
            relativeUrl: `${relativeUrl}/${entry.relativeUrl}`,
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
            relativeUrl,
            type,
            existent: true
          });
        }
      } else {
        added({
          relativeUrl,
          type
        });
      }
    } // we must watch manually every directory we find


    if (!fsWatchSupportsRecursive && type === "directory") {
      const watcher = createWatcher(urlToFileSystemPath(entryUrl), {
        persistent: keepProcessAlive
      });
      tracker.registerCleanupCallback(() => {
        watcher.close();
      });
      watcher.on("change", (eventType, filename) => {
        handleDirectoryEvent({
          directoryRelativeUrl: relativeUrl,
          filename: filename ? replaceBackSlashesWithSlashes(filename) : "",
          eventType
        });
      });
    }
  };

  const handleEntryLost = ({
    relativeUrl,
    type
  }) => {
    delete contentMap[relativeUrl];

    if (removed) {
      removed({
        relativeUrl,
        type
      });
    }
  };

  visitDirectory({
    directoryUrl: sourceUrl,
    entryFound: ({
      relativeUrl,
      type
    }) => {
      handleEntryFound({
        relativeUrl,
        type,
        existent: true
      });
    }
  });
  const watcher = createWatcher(urlToFileSystemPath(sourceUrl), {
    recursive: recursive && fsWatchSupportsRecursive,
    persistent: keepProcessAlive
  });
  tracker.registerCleanupCallback(() => {
    watcher.close();
  });
  watcher.on("change", (eventType, fileSystemPath) => {
    handleDirectoryEvent({ ...fileSystemPathToDirectoryRelativeUrlAndFilename(fileSystemPath),
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
  const directoryPath = urlToFileSystemPath(directoryUrl);
  fs.readdirSync(directoryPath).forEach(entry => {
    const entryUrl = resolveUrl$1(entry, directoryUrl);
    const type = fileSystemNodeToTypeOrNull(entryUrl);

    if (type === null) {
      return;
    }

    const relativeUrl = urlToRelativeUrl(entryUrl, directoryUrl);
    entryFound({
      relativeUrl,
      type
    });
  });
};

const fileSystemPathToDirectoryRelativeUrlAndFilename = path => {
  if (!path) {
    return {
      directoryRelativeUrl: "",
      filename: ""
    };
  }

  const normalizedPath = replaceBackSlashesWithSlashes(path);
  const slashLastIndex = normalizedPath.lastIndexOf("/");

  if (slashLastIndex === -1) {
    return {
      directoryRelativeUrl: "",
      filename: normalizedPath
    };
  }

  const directoryRelativeUrl = normalizedPath.slice(0, slashLastIndex);
  const filename = normalizedPath.slice(slashLastIndex + 1);
  return {
    directoryRelativeUrl,
    filename
  };
};

const registerFileLifecycle = (source, {
  added,
  updated,
  removed,
  notifyExistent = false,
  keepProcessAlive = true
}) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);

  if (!undefinedOrFunction$1(added)) {
    throw new TypeError(`added must be a function or undefined, got ${added}`);
  }

  if (!undefinedOrFunction$1(updated)) {
    throw new TypeError(`updated must be a function or undefined, got ${updated}`);
  }

  if (!undefinedOrFunction$1(removed)) {
    throw new TypeError(`removed must be a function or undefined, got ${removed}`);
  }

  const tracker = trackRessources();

  const handleFileFound = ({
    existent
  }) => {
    const fileMutationStopWatching = watchFileMutation(sourceUrl, {
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
    const fileCreationStopWatching = watchFileCreation(sourceUrl, () => {
      fileCreationgStopTracking();
      handleFileFound({
        existent: false
      });
    }, keepProcessAlive);
    const fileCreationgStopTracking = tracker.registerCleanupCallback(fileCreationStopWatching);
  };

  const sourceType = fileSystemNodeToTypeOrNull(sourceUrl);

  if (sourceType === null) {
    if (added) {
      watchFileAdded();
    } else {
      throw new Error(`${urlToFileSystemPath(sourceUrl)} must lead to a file, found nothing`);
    }
  } else if (sourceType === "file") {
    handleFileFound({
      existent: true
    });
  } else {
    throw new Error(`${urlToFileSystemPath(sourceUrl)} must lead to a file, type found instead`);
  }

  return tracker.cleanup;
};

const undefinedOrFunction$1 = value => typeof value === "undefined" || typeof value === "function";

const watchFileCreation = (source, callback, keepProcessAlive) => {
  const sourcePath = urlToFileSystemPath(source);
  const sourceFilename = path.basename(sourcePath);
  const directoryPath = path.dirname(sourcePath);
  let directoryWatcher = createWatcher(directoryPath, {
    persistent: keepProcessAlive
  });
  directoryWatcher.on("change", (eventType, filename) => {
    if (filename && filename !== sourceFilename) return;
    const type = fileSystemNodeToTypeOrNull(source); // ignore if something else with that name gets created
    // we are only interested into files

    if (type !== "file") return;
    directoryWatcher.close();
    directoryWatcher = undefined;
    callback();
  });
  return () => {
    if (directoryWatcher) {
      directoryWatcher.close();
    }
  };
};

const watchFileMutation = (sourceUrl, {
  updated,
  removed,
  keepProcessAlive
}) => {
  let watcher = createWatcher(urlToFileSystemPath(sourceUrl), {
    persistent: keepProcessAlive
  });
  watcher.on("change", () => {
    const sourceType = fileSystemNodeToTypeOrNull(sourceUrl);

    if (sourceType === null) {
      watcher.close();
      watcher = undefined;

      if (removed) {
        removed();
      }
    } else if (sourceType === "file") {
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

const resolveDirectoryUrl = (specifier, baseUrl) => {
  const url = resolveUrl$1(specifier, baseUrl);
  return ensureUrlTrailingSlash(url);
};

const {
  writeFile: writeFileNode
} = fs.promises;
const writeFile = async (destination, content = "") => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);

  try {
    await writeFileNode(destinationPath, content);
  } catch (error) {
    if (error.code === "ENOENT") {
      await ensureParentDirectories(destinationUrl);
      await writeFileNode(destinationPath, content);
      return;
    }

    throw error;
  }
};

/* eslint-disable */

const {
  template,
  types: t
} = require$1("@babel/core");

const {
  declare
} = require$1("@babel/helper-plugin-utils");

const {
  default: hoistVariables
} = require$1("@babel/helper-hoist-variables");

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

// https://github.com/drudru/ansi_up/blob/master/ansi_up.js

const Convert = require$1("ansi-to-html");

const ansiToHTML = ansiString => {
  return new Convert().toHtml(ansiString);
};

const {
  addSideEffect
} = require$1("@babel/helper-module-imports");

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
} = require$1("@babel/helper-module-imports");

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

// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-core/src/tools/build-external-helpers.js

const {
  list
} = require$1("@babel/helpers");

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
  const fileUrl = fileSystemPathToUrl(filePath);
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
} = require$1("@babel/helper-module-imports"); // named import approach found here:
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

/* eslint-disable import/max-dependencies */

const {
  transformAsync,
  transformFromAstAsync
} = require$1("@babel/core");

const syntaxDynamicImport = require$1("@babel/plugin-syntax-dynamic-import");

const syntaxImportMeta = require$1("@babel/plugin-syntax-import-meta");

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
    return urlToFileSystemPath(url);
  }

  return url;
};

const computeInputRelativePath = (url, projectDirectoryUrl) => {
  if (url.startsWith(projectDirectoryUrl)) {
    return urlToRelativeUrl(url, projectDirectoryUrl);
  }

  return undefined;
};

const transformCommonJs = require$1("babel-plugin-transform-commonjs");

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

const commonjs = require$1("@rollup/plugin-commonjs");

const nodeResolve = require$1("@rollup/plugin-node-resolve");

const builtins = require$1("rollup-plugin-node-builtins");

const createJSONRollupPlugin = require$1("@rollup/plugin-json");

const createNodeGlobalRollupPlugin = require$1("rollup-plugin-node-globals");

const createReplaceRollupPlugin = require$1("@rollup/plugin-replace");

const {
  rollup
} = require$1("rollup");

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

  const filePath = urlToFileSystemPath(url);
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
      dir: urlToFileSystemPath(resolveUrl$1("./", urlAfterTransform))
    } : {})
  };
  const result = await rollupBundle.generate(generateOptions);
  return result.output[0];
};
const __filenameReplacement$1 = `import.meta.url.slice('file:///'.length)`;
const __dirnameReplacement$1 = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`;

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

  throw new Error(`unexpected logLevel.
--- logLevel ---
${logLevel}
--- allowed log levels ---
${LOG_LEVEL_OFF}
${LOG_LEVEL_ERROR}
${LOG_LEVEL_WARN}
${LOG_LEVEL_INFO}
${LOG_LEVEL_DEBUG}`);
};
const debug = console.debug;

const debugDisabled = () => {};

const info = console.info;

const infoDisabled = () => {};

const warn = console.warn;

const warnDisabled = () => {};

const error = console.error;

const errorDisabled = () => {};

const disabledMethods = {
  debug: debugDisabled,
  info: infoDisabled,
  warn: warnDisabled,
  error: errorDisabled
};
const loggerIsMethodEnabled = (logger, methodName) => {
  return logger[methodName] !== disabledMethods[methodName];
};
const loggerToLevels = logger => {
  return {
    debug: loggerIsMethodEnabled(logger, "debug"),
    info: loggerIsMethodEnabled(logger, "info"),
    warn: loggerIsMethodEnabled(logger, "warn"),
    error: loggerIsMethodEnabled(logger, "error")
  };
};

const assertProjectDirectoryUrl = ({
  projectDirectoryUrl
}) => {
  return assertAndNormalizeDirectoryUrl(projectDirectoryUrl);
};
const assertProjectDirectoryExists = ({
  projectDirectoryUrl
}) => {
  assertDirectoryPresence(projectDirectoryUrl);
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
  if (!urlIsInsideOf(importMapFileUrl, projectDirectoryUrl)) {
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

const readPackageFile = async (packageFileUrl, manualOverrides) => {
  const packageFileString = await readFile(packageFileUrl);
  const packageJsonObject = JSON.parse(packageFileString);
  const {
    name,
    version
  } = packageJsonObject;
  const overrideKey = Object.keys(manualOverrides).find(overrideKeyCandidate => {
    if (name === overrideKeyCandidate) return true;
    if (`${name}@${version}` === overrideKeyCandidate) return true;
    return false;
  });

  if (overrideKey) {
    return composeObject(packageJsonObject, manualOverrides[overrideKey]);
  }

  return packageJsonObject;
};

const composeObject = (leftObject, rightObject) => {
  const composedObject = { ...leftObject
  };
  Object.keys(rightObject).forEach(key => {
    const rightValue = rightObject[key];

    if (rightValue === null || typeof rightValue !== "object" || key in leftObject === false) {
      composedObject[key] = rightValue;
    } else {
      const leftValue = leftObject[key];

      if (leftValue === null || typeof leftValue !== "object") {
        composedObject[key] = rightValue;
      } else {
        composedObject[key] = composeObject(leftValue, rightValue);
      }
    }
  });
  return composedObject;
};

const resolveNodeModule = async ({
  logger,
  rootProjectDirectoryUrl,
  manualOverrides,
  packageFileUrl,
  packageJsonObject,
  dependencyName,
  dependencyVersionPattern,
  dependencyType
}) => {
  const packageDirectoryUrl = resolveUrl$1("./", packageFileUrl);
  const nodeModuleCandidateArray = [...computeNodeModuleCandidateArray(packageDirectoryUrl, rootProjectDirectoryUrl), `node_modules/`];
  const result = await firstOperationMatching({
    array: nodeModuleCandidateArray,
    start: async nodeModuleCandidate => {
      const packageFileUrl = `${rootProjectDirectoryUrl}${nodeModuleCandidate}${dependencyName}/package.json`;

      try {
        const packageJsonObject = await readPackageFile(packageFileUrl, manualOverrides);
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
${urlToFileSystemPath(packageFileUrl)}
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
${urlToFileSystemPath(packageFileUrl)}
    `);
  }

  return result;
};

const computeNodeModuleCandidateArray = (packageDirectoryUrl, rootProjectDirectoryUrl) => {
  if (packageDirectoryUrl === rootProjectDirectoryUrl) {
    return [];
  }

  const packageDirectoryRelativeUrl = urlToRelativeUrl(packageDirectoryUrl, rootProjectDirectoryUrl);
  const candidateArray = [];
  const relativeNodeModuleDirectoryArray = `./${packageDirectoryRelativeUrl}`.split("/node_modules/"); // remove the first empty string

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

  const packageFilePath = urlToFileSystemPath(packageFileUrl);
  const packageDirectoryUrl = resolveUrl$1("./", packageFileUrl);
  const mainFileRelativeUrl = packageMainFieldValue.endsWith("/") ? `${packageMainFieldValue}index` : packageMainFieldValue;
  const mainFileUrlFirstCandidate = resolveUrl$1(mainFileRelativeUrl, packageFileUrl);

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
      const extensionTried = path.extname(urlToFileSystemPath(mainFileUrlFirstCandidate)) === "" ? `--- extensions tried ---
${extensionCandidateArray.join(`,`)}
` : `
`;
      logger.warn(`
cannot find file for package.json ${packageMainFieldName} field
--- ${packageMainFieldName} ---
${packageMainFieldValue}
--- file path ---
${urlToFileSystemPath(mainFileUrlFirstCandidate)}
--- package.json path ---
${packageFilePath}
${extensionTried}`);
    }

    return mainFileUrlFirstCandidate;
  }

  return mainFileUrl;
};

const findMainFileUrlOrNull = async mainFileUrl => {
  const mainStats = await readFileSystemNodeStat(mainFileUrl, {
    nullIfNotFound: true
  });

  if (mainStats && mainStats.isFile()) {
    return mainFileUrl;
  }

  if (mainStats && mainStats.isDirectory()) {
    const indexFileUrl = resolveUrl$1("./index", mainFileUrl.endsWith("/") ? mainFileUrl : `${mainFileUrl}/`);
    const extensionLeadingToAFile = await findExtension(indexFileUrl);

    if (extensionLeadingToAFile === null) {
      return null;
    }

    return `${indexFileUrl}.${extensionLeadingToAFile}`;
  }

  const mainFilePath = urlToFileSystemPath(mainFileUrl);
  const extension = path.extname(mainFilePath);

  if (extension === "") {
    const extensionLeadingToAFile = await findExtension(mainFileUrl);

    if (extensionLeadingToAFile === null) {
      return null;
    }

    return `${mainFileUrl}.${extensionLeadingToAFile}`;
  }

  return null;
};

const findExtension = async fileUrl => {
  const filePath = urlToFileSystemPath(fileUrl);
  const fileDirname = path.dirname(filePath);
  const fileBasename = path.basename(filePath);
  const extensionLeadingToFile = await firstOperationMatching({
    array: extensionCandidateArray,
    start: async extensionCandidate => {
      const filePathCandidate = `${fileDirname}/${fileBasename}.${extensionCandidate}`;
      const stats = await readFileSystemNodeStat(filePathCandidate, {
        nullIfNotFound: true
      });
      return stats && stats.isFile() ? extensionCandidate : null;
    },
    predicate: extension => Boolean(extension)
  });
  return extensionLeadingToFile || null;
};

const specifierIsRelative = specifier => {
  if (specifier.startsWith("//")) {
    return false;
  }

  if (specifier.startsWith("../")) {
    return false;
  } // starts with http:// or file:// or ftp: for instance


  if (/^[a-zA-Z]+\:/.test(specifier)) {
    return false;
  }

  return true;
};

const visitPackageImports = ({
  logger,
  packageFileUrl,
  packageJsonObject
}) => {
  const importsForPackageImports = {};
  const packageFilePath = urlToFileSystemPath(packageFileUrl);
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
    if (!specifierIsRelative(specifier)) {
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

    if (!specifierIsRelative(address)) {
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

// https://nodejs.org/dist/latest-v13.x/docs/api/esm.html#esm_package_exports
const visitPackageExports = ({
  logger,
  packageFileUrl,
  packageName,
  packageJsonObject,
  packageInfo: {
    packageDirectoryRelativeUrl
  },
  favoredExports
}) => {
  const importsForPackageExports = {};
  const packageFilePath = urlToFileSystemPath(packageFileUrl);
  const {
    exports: packageExports
  } = packageJsonObject; // false is allowed as laternative to exports: {}

  if (packageExports === false) return importsForPackageExports;

  const addressToDestination = address => {
    if (address[0] === "/") {
      return address;
    }

    if (address.startsWith("./")) {
      return `./${packageDirectoryRelativeUrl}${address.slice(2)}`;
    }

    return `./${packageDirectoryRelativeUrl}${address}`;
  }; // exports used to indicate the main file


  if (typeof packageExports === "string") {
    const from = packageName;
    const to = addressToDestination(packageExports);
    importsForPackageExports[from] = to;
    return importsForPackageExports;
  }

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

  const packageExportsKeys = Object.keys(packageExports);
  const someSpecifierStartsWithDot = packageExportsKeys.some(key => key.startsWith("."));

  if (someSpecifierStartsWithDot) {
    const someSpecifierDoesNotStartsWithDot = packageExportsKeys.some(key => !key.startsWith("."));

    if (someSpecifierDoesNotStartsWithDot) {
      // see https://nodejs.org/dist/latest-v13.x/docs/api/esm.html#esm_exports_sugar
      logger.error(`
exports of package.json mixes conditional exports and direct exports.
--- package.json path ---
${packageFilePath}
`);
      return importsForPackageExports;
    }
  }

  packageExportsKeys.forEach(specifier => {
    if (!specifierIsRelative(specifier)) {
      logger.warn(`
found unexpected specifier in exports of package.json, it must be relative to package.json.
--- specifier ---
${specifier}
--- package.json path ---
${packageFilePath}
`);
      return;
    }

    const value = packageExports[specifier];
    let address;

    if (typeof value === "object") {
      const favoredExport = favoredExports.find(key => key in value);

      if (favoredExport) {
        address = value[favoredExport];
      } else if ("default" in value) {
        address = value.default;
      } else {
        return;
      }
    } else if (typeof value === "string") {
      address = value;
    } else {
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

    if (!specifierIsRelative(address)) {
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

    if (specifier === ".") {
      from = packageName;
    } else if (specifier[0] === "/") {
      from = specifier;
    } else if (specifier.startsWith("./")) {
      from = `${packageName}${specifier.slice(1)}`;
    } else {
      from = `${packageName}/${specifier}`;
    }

    const to = addressToDestination(address);
    importsForPackageExports[from] = to;
  });
  return importsForPackageExports;
};

/* eslint-disable import/max-dependencies */
const generateImportMapForPackage = async ({
  logger,
  projectDirectoryUrl,
  rootProjectDirectoryUrl,
  manualOverrides = {},
  includeDevDependencies = false,
  includeExports = true,
  // pass ['browser', 'default'] to read browser first then 'default' if defined
  // in package exports field
  favoredExports = ["import", "node", "require"],
  includeImports = true,
  // this is not yet standard, should be false by default
  selfImport = false
}) => {
  projectDirectoryUrl = assertAndNormalizeDirectoryUrl(projectDirectoryUrl);

  if (typeof rootProjectDirectoryUrl === "undefined") {
    rootProjectDirectoryUrl = projectDirectoryUrl;
  } else {
    rootProjectDirectoryUrl = assertAndNormalizeDirectoryUrl(rootProjectDirectoryUrl);
  }

  const projectPackageFileUrl = resolveUrl$1("./package.json", projectDirectoryUrl);
  const rootProjectPackageFileUrl = resolveUrl$1("./package.json", rootProjectDirectoryUrl);
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
    importerPackageJsonObject,
    includeDevDependencies
  }) => {
    await visitPackage({
      packageFileUrl,
      packageName,
      packageJsonObject,
      importerPackageFileUrl,
      importerPackageJsonObject
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
    importerPackageFileUrl,
    importerPackageJsonObject
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

    if (includeImports && "imports" in packageJsonObject) {
      const importsForPackageImports = visitPackageImports({
        logger,
        packageFileUrl,
        packageName,
        packageJsonObject,
        packageInfo
      });
      const {
        packageIsRoot,
        packageDirectoryRelativeUrl
      } = packageInfo;
      Object.keys(importsForPackageImports).forEach(from => {
        const to = importsForPackageImports[from];

        if (packageIsRoot) {
          addImportMapping({
            from,
            to
          });
        } else {
          const toScoped = to[0] === "/" ? to : `./${packageDirectoryRelativeUrl}${to.startsWith("./") ? to.slice(2) : to}`;
          addScopedImportMapping({
            scope: `./${packageDirectoryRelativeUrl}`,
            from,
            to: toScoped
          }); // when a package says './' maps to './'
          // we must add something to say if we are already inside the package
          // no need to ensure leading slash are scoped to the package

          if (from === "./" && to === "./") {
            addScopedImportMapping({
              scope: `./${packageDirectoryRelativeUrl}`,
              from: `./${packageDirectoryRelativeUrl}`,
              to: `./${packageDirectoryRelativeUrl}`
            });
          } else if (from === "/" && to === "/") {
            addScopedImportMapping({
              scope: `./${packageDirectoryRelativeUrl}`,
              from: `./${packageDirectoryRelativeUrl}`,
              to: `./${packageDirectoryRelativeUrl}`
            });
          }
        }
      });
    }

    if (selfImport) {
      const {
        packageIsRoot,
        packageDirectoryRelativeUrl
      } = packageInfo; // allow import 'package-name/dir/file.js' in package-name files

      if (packageIsRoot) {
        addImportMapping({
          from: `${packageName}/`,
          to: `./${packageDirectoryRelativeUrl}`
        });
      } // scoped allow import 'package-name/dir/file.js' in package-name files
      else {
          addScopedImportMapping({
            scope: `./${packageDirectoryRelativeUrl}`,
            from: `${packageName}/`,
            to: `./${packageDirectoryRelativeUrl}`
          });
        }
    }

    if (includeExports && "exports" in packageJsonObject) {
      const importsForPackageExports = visitPackageExports({
        logger,
        packageFileUrl,
        packageName,
        packageJsonObject,
        packageInfo,
        favoredExports
      });
      const {
        importerIsRoot,
        importerRelativeUrl,
        packageIsRoot,
        packageDirectoryRelativeUrl // packageDirectoryUrl,
        // packageDirectoryUrlExpected,

      } = packageInfo;

      if (packageIsRoot && selfImport) {
        Object.keys(importsForPackageExports).forEach(from => {
          const to = importsForPackageExports[from];
          addImportMapping({
            from,
            to
          });
        });
      } else if (packageIsRoot) ; else {
        Object.keys(importsForPackageExports).forEach(from => {
          const to = importsForPackageExports[from]; // own package exports available to himself

          if (importerIsRoot) {
            // importer is the package himself, keep exports scoped
            // otherwise the dependency exports would override the package exports.
            if (importerPackageJsonObject.name === packageName) {
              addScopedImportMapping({
                scope: `./${packageDirectoryRelativeUrl}`,
                from,
                to
              });

              if (from === packageName || from in imports === false) {
                addImportMapping({
                  from,
                  to
                });
              }
            } else {
              addImportMapping({
                from,
                to
              });
            }
          } else {
            addScopedImportMapping({
              scope: `./${packageDirectoryRelativeUrl}`,
              from,
              to
            });
          } // now make package exports available to the importer
          // if importer is root no need because the top level remapping does it


          if (importerIsRoot) {
            return;
          } // now make it available to the importer
          // here if the importer is himself we could do stuff
          // we should even handle the case earlier to prevent top level remapping


          addScopedImportMapping({
            scope: `./${importerRelativeUrl}`,
            from,
            to
          });
        });
      }
    }
  };

  const visitPackageMain = async ({
    packageFileUrl,
    packageName,
    packageJsonObject,
    packageInfo: {
      importerIsRoot,
      importerRelativeUrl,
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
    const mainFileRelativeUrl = urlToRelativeUrl(mainFileUrl, rootProjectDirectoryUrl);
    const from = packageName;
    const to = `./${mainFileRelativeUrl}`;

    if (importerIsRoot) {
      addImportMapping({
        from,
        to
      });
    } else {
      addScopedImportMapping({
        scope: `./${importerRelativeUrl}`,
        from,
        to
      });
    }

    if (packageDirectoryUrl !== packageDirectoryUrlExpected) {
      addScopedImportMapping({
        scope: `./${importerRelativeUrl}`,
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
      importerPackageFileUrl: packageFileUrl,
      importerPackageJsonObject: packageJsonObject
    });
  };

  const computePackageInfo = ({
    packageFileUrl,
    packageName,
    importerPackageFileUrl
  }) => {
    const importerIsRoot = importerPackageFileUrl === rootProjectPackageFileUrl;
    const importerIsProject = importerPackageFileUrl === projectPackageFileUrl;
    const importerPackageDirectoryUrl = resolveUrl$1("./", importerPackageFileUrl);
    const importerRelativeUrl = importerIsRoot ? `${path.basename(rootProjectDirectoryUrl)}/` : urlToRelativeUrl(importerPackageDirectoryUrl, rootProjectDirectoryUrl);
    const packageIsRoot = packageFileUrl === rootProjectPackageFileUrl;
    const packageIsProject = packageFileUrl === projectPackageFileUrl;
    const packageDirectoryUrl = resolveUrl$1("./", packageFileUrl);
    let packageDirectoryUrlExpected;

    if (packageIsProject && !packageIsRoot) {
      packageDirectoryUrlExpected = importerPackageDirectoryUrl;
    } else {
      packageDirectoryUrlExpected = `${importerPackageDirectoryUrl}node_modules/${packageName}/`;
    }

    const packageDirectoryRelativeUrl = urlToRelativeUrl(packageDirectoryUrl, rootProjectDirectoryUrl);
    return {
      importerIsRoot,
      importerIsProject,
      importerRelativeUrl,
      packageIsRoot,
      packageIsProject,
      packageDirectoryUrl,
      packageDirectoryUrlExpected,
      packageDirectoryRelativeUrl
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
      manualOverrides,
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

  const projectPackageJsonObject = await readPackageFile(projectPackageFileUrl, manualOverrides);
  const packageFileUrl = projectPackageFileUrl;
  const importerPackageFileUrl = projectPackageFileUrl;
  markPackageAsSeen(packageFileUrl, importerPackageFileUrl);
  const packageName = projectPackageJsonObject.name;

  if (typeof packageName === "string") {
    await visit({
      packageFileUrl,
      packageName: projectPackageJsonObject.name,
      packageJsonObject: projectPackageJsonObject,
      importerPackageFileUrl,
      importerPackageJsonObject: null,
      includeDevDependencies
    });
  } else {
    logger.warn(`package name field must be a string
--- package name field ---
${packageName}
--- package.json file path ---
${packageFileUrl}`);
  } // remove useless duplicates (scoped key+value already defined on imports)


  Object.keys(scopes).forEach(key => {
    const scopedImports = scopes[key];
    Object.keys(scopedImports).forEach(scopedImportKey => {
      if (scopedImportKey in imports && imports[scopedImportKey] === scopedImports[scopedImportKey]) {
        delete scopedImports[scopedImportKey];
      }
    });

    if (Object.keys(scopedImports).length === 0) {
      delete scopes[key];
    }
  });
  return sortImportMap({
    imports,
    scopes
  });
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
  "accept": composeHeaderValues,
  "accept-charset": composeHeaderValues,
  "accept-language": composeHeaderValues,
  "access-control-allow-headers": composeHeaderValues,
  "access-control-allow-methods": composeHeaderValues,
  "access-control-allow-origin": composeHeaderValues,
  // 'content-type', // https://github.com/ninenines/cowboy/issues/1230
  "vary": composeHeaderValues
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
  return subscription || {
    unsubscribe: () => {}
  };
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
        "connection": "keep-alive"
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

const jsenvContentTypeMap = {
  "application/javascript": {
    extensions: ["js", "cjs", "mjs", "ts", "jsx"]
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

const {
  readFile: readFile$1
} = fs.promises;
const serveFile = async (source, {
  cancellationToken = createCancellationToken(),
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

  const sourceUrl = assertAndNormalizeFileUrl(source);
  const clientCacheDisabled = headers["cache-control"] === "no-cache";

  try {
    const cacheWithMtime = !clientCacheDisabled && cacheStrategy === "mtime";
    const cacheWithETag = !clientCacheDisabled && cacheStrategy === "etag";
    const cachedDisabled = clientCacheDisabled || cacheStrategy === "none";
    const sourceStat = await createOperation({
      cancellationToken,
      start: () => readFileSystemNodeStat(sourceUrl)
    });

    if (sourceStat.isDirectory()) {
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

      const directoryContentArray = await createOperation({
        cancellationToken,
        start: () => readDirectory(sourceUrl)
      });
      const directoryContentJson = JSON.stringify(directoryContentArray);
      return {
        status: 200,
        headers: { ...(cachedDisabled ? {
            "cache-control": "no-store"
          } : {}),
          "content-type": "application/json",
          "content-length": directoryContentJson.length
        },
        body: directoryContentJson
      };
    } // not a file, give up


    if (!sourceStat.isFile()) {
      return {
        status: 404,
        headers: { ...(cachedDisabled ? {
            "cache-control": "no-store"
          } : {})
        }
      };
    }

    if (cacheWithETag) {
      const fileContentAsBuffer = await createOperation({
        cancellationToken,
        start: () => readFile$1(urlToFileSystemPath(sourceUrl))
      });
      const fileContentEtag = bufferToEtag(fileContentAsBuffer);

      if ("if-none-match" in headers && headers["if-none-match"] === fileContentEtag) {
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
          "content-length": sourceStat.size,
          "content-type": urlToContentType(sourceUrl, contentTypeMap),
          "etag": fileContentEtag
        },
        body: fileContentAsBuffer
      };
    }

    if (cacheWithMtime && "if-modified-since" in headers) {
      let cachedModificationDate;

      try {
        cachedModificationDate = new Date(headers["if-modified-since"]);
      } catch (e) {
        return {
          status: 400,
          statusText: "if-modified-since header is not a valid date"
        };
      }

      const actualModificationDate = dateToSecondsPrecision(sourceStat.mtime);

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
        ...(cacheWithMtime ? {
          "last-modified": dateToUTCString(sourceStat.mtime)
        } : {}),
        "content-length": sourceStat.size,
        "content-type": urlToContentType(sourceUrl, contentTypeMap)
      },
      body: fs.createReadStream(urlToFileSystemPath(sourceUrl))
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

const require$2 = module$1.createRequire(url);

const nodeFetch = require$2("node-fetch");

const AbortController = require$2("abort-controller");

const {
  Response
} = nodeFetch;
const fetchUrl = async (url, {
  cancellationToken = createCancellationToken(),
  simplified = false,
  ignoreHttpsError = false,
  canReadDirectory,
  contentTypeMap,
  cacheStrategy,
  ...options
} = {}) => {
  try {
    url = String(new URL(url));
  } catch (e) {
    throw new Error(`fetchUrl first argument must be an absolute url, received ${url}`);
  }

  if (url.startsWith("file://")) {
    const {
      status,
      statusText,
      headers,
      body
    } = await serveFile(url, {
      cancellationToken,
      cacheStrategy,
      canReadDirectory,
      contentTypeMap,
      ...options
    });
    const response = new Response(typeof body === "string" ? Buffer.from(body) : body, {
      url,
      status,
      statusText,
      headers
    });
    return simplified ? standardResponseToSimplifiedResponse(response) : response;
  } // cancellation might be requested early, abortController does not support that
  // so we have to throw if requested right away


  cancellationToken.throwIfRequested(); // https://github.com/bitinn/node-fetch#request-cancellation-with-abortsignal

  const abortController = new AbortController();
  let cancelError;
  cancellationToken.register(reason => {
    cancelError = reason;
    abortController.abort(reason);
  });
  let response;

  try {
    response = await nodeFetch(url, {
      signal: abortController.signal,
      ...(ignoreHttpsError && url.startsWith("https") ? {
        agent: new https.Agent({
          rejectUnauthorized: false
        })
      } : {}),
      ...options
    });
  } catch (e) {
    if (cancelError && e.name === "AbortError") {
      throw cancelError;
    }

    throw e;
  }

  return simplified ? standardResponseToSimplifiedResponse(response) : response;
};

const standardResponseToSimplifiedResponse = async response => {
  const text = await response.text();
  return {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: responseToHeaders(response),
    body: text
  };
};

const responseToHeaders = response => {
  const headers = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  return headers;
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

const urlToOrigin$1 = url => {
  return new URL(url).origin;
};

const createServer = async ({
  http2,
  http1Allowed,
  protocol,
  privateKey,
  certificate
}) => {
  if (protocol === "http") {
    if (http2) {
      const {
        createServer
      } = await new Promise(function (resolve) { resolve(_interopNamespace(require('http2'))); });
      return createServer();
    }

    const {
      createServer
    } = await new Promise(function (resolve) { resolve(_interopNamespace(require('http'))); });
    return createServer();
  }

  if (protocol === "https") {
    if (http2) {
      const {
        createSecureServer
      } = await new Promise(function (resolve) { resolve(_interopNamespace(require('http2'))); });
      return createSecureServer({
        key: privateKey,
        cert: certificate,
        allowHTTP1: http1Allowed
      });
    }

    const {
      createServer
    } = await new Promise(function (resolve) { resolve(_interopNamespace(require('https'))); });
    return createServer({
      key: privateKey,
      cert: certificate
    });
  }

  throw new Error(`unsupported protocol ${protocol}`);
};

const trackServerPendingConnections = (nodeServer, {
  onConnectionError
}) => {
  const pendingConnections = new Set();

  const connectionListener = connection => {
    connection.on("close", () => {
      pendingConnections.delete(connection);
    });

    if (onConnectionError) {
      connection.on("error", error => {
        onConnectionError(error, connection);
      });
    }

    pendingConnections.add(connection);
  };

  nodeServer.on("connection", connectionListener);

  const stop = async reason => {
    nodeServer.removeListener("connection", connectionListener);
    await Promise.all(Array.from(pendingConnections).map(pendingConnection => {
      return new Promise((resolve, reject) => {
        pendingConnection.destroy(reason, error => {
          if (error) {
            if (error === reason || error.code === "ENOTCONN") {
              resolve();
            } else {
              reject(error);
            }
          } else {
            resolve();
          }
        });
      });
    }));
  };

  return {
    stop
  };
};

const trackServerPendingRequests = nodeServer => {
  const pendingClients = new Set();

  const requestListener = (nodeRequest, nodeResponse) => {
    const client = {
      nodeRequest,
      nodeResponse
    };
    pendingClients.add(client);
    nodeResponse.on("close", () => {
      pendingClients.delete(client);
    });
  };

  nodeServer.on("request", requestListener);

  const stop = ({
    status,
    reason
  }) => {
    nodeServer.removeListener("request", requestListener);
    return Promise.all(Array.from(pendingClients).map(({
      nodeResponse
    }) => {
      if (nodeResponse.headersSent === false) {
        nodeResponse.writeHead(status, reason);
      } // http2


      if (nodeResponse.close) {
        return new Promise((resolve, reject) => {
          if (nodeResponse.closed) {
            resolve();
          } else {
            nodeResponse.close(error => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          }
        });
      } // http


      return new Promise(resolve => {
        if (nodeResponse.destroyed) {
          resolve();
        } else {
          nodeResponse.once("close", () => {
            resolve();
          });
          nodeResponse.destroy();
        }
      });
    }));
  };

  return {
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
      // should we do nodeStream.resume() in case the stream was paused ?
      nodeStream.on("data", next);
      nodeStream.once("error", error);
      nodeStream.once("end", complete);

      const unsubscribe = () => {
        nodeStream.removeListener("data", next);
        nodeStream.removeListener("error", error);
        nodeStream.removeListener("end", complete);

        if (typeof nodeStream.abort === "function") {
          nodeStream.abort();
        } else {
          nodeStream.destroy();
        }
      };

      if (typeof nodeStream.once === "function") {
        nodeStream.once("abort", unsubscribe);
      }

      return {
        unsubscribe
      };
    }
  });
};

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
    if (headerName[0] === ":") {
      // exclude http2 headers
      return;
    }

    headers[normalizeHeaderName(headerName)] = normalizeHeaderValue(headersObject[headerName]);
  });
  return headers;
};

const nodeRequestToRequest = (nodeRequest, {
  serverCancellationToken,
  serverOrigin
}) => {
  const {
    method
  } = nodeRequest;
  const {
    url: ressource
  } = nodeRequest;
  const headers = headersFromObject(nodeRequest.headers);
  const body = method === "POST" || method === "PUT" || method === "PATCH" ? nodeStreamToObservable(nodeRequest) : undefined;
  return Object.freeze({
    // the node request is considered as cancelled if client cancels or server cancels.
    // in case of server cancellation from a client perspective request is not cancelled
    // because client still wants a response. But from a server perspective the production
    // of a response for this request is cancelled
    cancellationToken: composeCancellationToken(serverCancellationToken, nodeRequestToCancellationToken(nodeRequest)),
    origin: serverOrigin,
    ressource,
    method,
    headers,
    body
  });
};

const nodeRequestToCancellationToken = nodeRequest => {
  const {
    cancel,
    token
  } = createCancellationSource();
  nodeRequest.on("abort", () => {
    cancel("request aborted");
  });
  return token;
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
  cancellationToken,
  ignoreBody,
  ignoreStatusText
} = {}) => {
  const nodeHeaders = headersToNodeHeaders(headers); // nodejs strange signature for writeHead force this
  // https://nodejs.org/api/http.html#http_response_writehead_statuscode_statusmessage_headers

  if (statusText === undefined || ignoreStatusText) {
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
      try {
        nodeResponse.write(data);
      } catch (e) {
        // Something inside Node.js sometimes puts stream
        // in a state where .write() throw despites nodeResponse.destroyed
        // being undefined and "close" event not being emitted.
        // I have tested if we are the one calling destroy
        // (I have commented every .destroy() call)
        // but issue still occurs
        // For the record it's "hard" to reproduce but can be by running
        // a lot of tests against a browser in the context of @jsenv/core testing
        if (e.code === "ERR_HTTP2_INVALID_STREAM") {
          return;
        }

        throw e;
      }
    },
    error: value => {
      nodeResponse.emit("error", value);
    },
    complete: () => {
      nodeResponse.end();
    }
  });
  cancellationToken.register(() => {
    subscription.unsubscribe();
    nodeResponse.destroy();
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
  const url = new url$1.URL("https://127.0.0.1:80");
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

const STOP_REASON_INTERNAL_ERROR = createReason("Internal error");
const STOP_REASON_PROCESS_SIGHUP = createReason("process SIGHUP");
const STOP_REASON_PROCESS_SIGTERM = createReason("process SIGTERM");
const STOP_REASON_PROCESS_SIGINT = createReason("process SIGINT");
const STOP_REASON_PROCESS_BEFORE_EXIT = createReason("process before exit");
const STOP_REASON_PROCESS_EXIT = createReason("process exit");
const STOP_REASON_NOT_SPECIFIED = createReason("not specified");

const require$3 = module$1.createRequire(url);

const killPort = require$3("kill-port");

const startServer = async ({
  cancellationToken = createCancellationToken(),
  logLevel,
  serverName = "server",
  protocol = "http",
  http2 = false,
  http1Allowed = true,
  ip = "127.0.0.1",
  port = 0,
  // assign a random available port
  forcePort = false,
  privateKey = jsenvPrivateKey,
  certificate = jsenvCertificate,
  stopOnSIGINT = true,
  // auto close the server when the process exits
  stopOnExit = true,
  // auto close when requestToResponse throw an error
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
  stoppedCallback = () => {},
  errorIsCancellation = () => false
} = {}) => {
  return catchCancellation(async () => {
    if (port === 0 && forcePort) {
      throw new Error(`no need to pass forcePort when port is 0`);
    }

    if (protocol !== "http" && protocol !== "https") {
      throw new Error(`protocol must be http or https, got ${protocol}`);
    } // https://github.com/nodejs/node/issues/14900


    if (ip === "0.0.0.0" && process.platform === "win32") {
      throw new Error(`listening ${ip} not available on window`);
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
    }

    const internalCancellationSource = createCancellationSource();
    const externalCancellationToken = cancellationToken;
    const internalCancellationToken = internalCancellationSource.token;
    const serverCancellationToken = composeCancellationToken(externalCancellationToken, internalCancellationToken);
    const logger = createLogger({
      logLevel
    });

    const onError = error => {
      if (errorIsCancellation(error)) {
        return;
      }

      throw error;
    };

    errorIsCancellation = composePredicate(errorIsCancellation, isCancelError);
    const {
      registerCleanupCallback,
      cleanup
    } = createTracker();

    if (stopOnCrash) {
      const unregister = unadvisedCrashSignal.addCallback(reason => {
        internalCancellationSource.cancel(reason.value);
      });
      registerCleanupCallback(unregister);
    }

    if (stopOnExit) {
      const unregister = teardownSignal.addCallback(tearDownReason => {
        if (!stopOnSIGINT && tearDownReason === "SIGINT") {
          return;
        }

        internalCancellationSource.cancel({
          SIGHUP: STOP_REASON_PROCESS_SIGHUP,
          SIGTERM: STOP_REASON_PROCESS_SIGTERM,
          SIGINT: STOP_REASON_PROCESS_SIGINT,
          beforeExit: STOP_REASON_PROCESS_BEFORE_EXIT,
          exit: STOP_REASON_PROCESS_EXIT
        }[tearDownReason]);
      });
      registerCleanupCallback(unregister);
    } else if (stopOnSIGINT) {
      const unregister = SIGINTSignal.addCallback(() => {
        internalCancellationSource.cancel(STOP_REASON_PROCESS_SIGINT);
      });
      registerCleanupCallback(unregister);
    }

    if (forcePort) {
      await createOperation({
        cancellationToken: serverCancellationToken,
        start: () => killPort(port)
      });
    }

    const nodeServer = await createServer({
      http2,
      http1Allowed,
      protocol,
      privateKey,
      certificate
    }); // https://nodejs.org/api/net.html#net_server_unref

    if (!keepProcessAlive) {
      nodeServer.unref();
    }

    let status = "starting";
    let stoppedResolve;
    const stoppedPromise = new Promise(resolve => {
      stoppedResolve = resolve;
    });
    const stop = memoize(async (reason = STOP_REASON_NOT_SPECIFIED) => {
      status = "stopping";
      errorIsCancellation = composePredicate(errorIsCancellation, error => error === reason);
      errorIsCancellation = composePredicate(errorIsCancellation, error => error && error.code === "ECONNRESET");
      logger.info(`${serverName} stopped because ${reason}`);
      await cleanup(reason);
      await stopListening(nodeServer);
      status = "stopped";
      stoppedCallback({
        reason
      });
      stoppedResolve(reason);
    });
    serverCancellationToken.register(stop);
    const startOperation = createStoppableOperation({
      cancellationToken: serverCancellationToken,
      start: () => listen({
        cancellationToken: serverCancellationToken,
        server: nodeServer,
        port,
        ip
      }),
      stop: (_, reason) => stop(reason)
    });
    port = await startOperation;
    status = "opened";
    const serverOrigin = originAsString({
      protocol,
      ip,
      port
    });
    const connectionsTracker = trackServerPendingConnections(nodeServer, {
      onConnectionError: (error, connection) => {
        if (!connection.destroyed) {
          onError(error);
        }
      }
    }); // opened connection must be shutdown before the close event is emitted

    registerCleanupCallback(connectionsTracker.stop);
    const pendingRequestsTracker = trackServerPendingRequests(nodeServer); // ensure pending requests got a response from the server

    registerCleanupCallback(reason => {
      pendingRequestsTracker.stop({
        status: reason === STOP_REASON_INTERNAL_ERROR ? 500 : 503,
        reason
      });
    });

    const requestCallback = async (nodeRequest, nodeResponse) => {
      const request = nodeRequestToRequest(nodeRequest, {
        serverCancellationToken,
        serverOrigin
      });
      nodeRequest.on("error", error => {
        logger.error(`error on request.
--- request ressource ---
${request.ressource}
--- error stack ---
${error.stack}`);
      });
      const {
        response,
        error
      } = await generateResponseDescription(request);
      logger.info(`${request.method} ${request.origin}${request.ressource}`);

      if (error && isCancelError(error) && internalCancellationToken.cancellationRequested) {
        logger.info("ignored because server closing");
        nodeResponse.destroy();
        return;
      }

      if (request.aborted) {
        logger.info(`request aborted by client`);
        nodeResponse.destroy();
        return;
      }

      if (request.method !== "HEAD" && response.headers["content-length"] > 0 && response.body === "") {
        logger.error(createContentLengthMismatchError(`content-length header is ${response.headers["content-length"]} but body is empty`));
      }

      if (error) {
        logger.error(`internal error while handling request.
--- error stack ---
${error.stack}
--- request ---
${request.method} ${request.origin}${request.ressource}`);
      }

      logger.info(`${colorizeResponseStatus(response.status)} ${response.statusText}`);
      populateNodeResponse(nodeResponse, response, {
        cancellationToken: request.cancellationToken,
        ignoreBody: request.method === "HEAD",
        // https://github.com/nodejs/node/blob/79296dc2d02c0b9872bbfcbb89148ea036a546d0/lib/internal/http2/compat.js#L97
        ignoreStatusText: Boolean(nodeRequest.stream)
      });

      if (stopOnInternalError && // stopOnInternalError stops server only if requestToResponse generated
      // a non controlled error (internal error).
      // if requestToResponse gracefully produced a 500 response (it did not throw)
      // then we can assume we are still in control of what we are doing
      error) {
        // il faudrais pouvoir stop que les autres response ?
        stop(STOP_REASON_INTERNAL_ERROR);
      }
    };

    nodeServer.on("request", requestCallback); // ensure we don't try to handle new requests while server is stopping

    registerCleanupCallback(() => {
      nodeServer.removeListener("request", requestCallback);
    });
    logger.info(`${serverName} started at ${serverOrigin}`);
    startedCallback({
      origin: serverOrigin
    });
    const corsEnabled = accessControlAllowRequestOrigin || accessControlAllowedOrigins.length; // here we check access control options to throw or warn if we find strange values

    const generateResponseDescription = async request => {
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
          response: responsePropertiesToResponse(responseProperties || {})
        };
      } catch (error) {
        return {
          response: composeResponse(responsePropertiesToResponse({
            status: 500,
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
      origin: serverOrigin,
      nodeServer,
      stop,
      stoppedPromise
    };
  });
};

const statusToStatusText = status => http.STATUS_CODES[status] || "not specified";

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
      allowedOriginArray.push(urlToOrigin$1(headers.referer));
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

const composePredicate = (previousPredicate, predicate) => {
  return value => {
    return previousPredicate(value) || predicate(value);
  };
};

let jsenvCoreDirectoryUrl;

if (typeof __filename === "string") {
  jsenvCoreDirectoryUrl = resolveUrl$1( // get ride of dist/commonjs/main.js
  "../../", fileSystemPathToUrl(__filename));
} else {
  jsenvCoreDirectoryUrl = resolveUrl$1( // get ride of src/internal/jsenvCoreDirectoryUrl.js
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
// https://github.com/babel/babel/blob/master/packages/babel-compat-data/data/plugins.json#L1
// Because this is an hidden implementation detail of @babel/preset-env
// it could be deprecated or moved anytime.
// For that reason it makes more sens to have it inlined here
// than importing it from an undocumented location.
// Ideally it would be documented or a separate module
const jsenvBabelPluginCompatMap = {
  "proposal-nullish-coalescing-operator": {
    chrome: "80",
    firefox: "72",
    safari: "tp",
    opera: "67"
  },
  "proposal-optional-chaining": {
    chrome: "80",
    firefox: "74",
    safari: "tp",
    opera: "67"
  },
  "proposal-json-strings": {
    chrome: "66",
    edge: "79",
    firefox: "62",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "9",
    opera: "53",
    electron: "3.1"
  },
  "proposal-optional-catch-binding": {
    chrome: "66",
    edge: "79",
    firefox: "58",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    opera: "53",
    electron: "3.1"
  },
  "proposal-async-generator-functions": {
    chrome: "63",
    edge: "79",
    firefox: "57",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "8",
    opera: "50",
    electron: "3.1"
  },
  "proposal-object-rest-spread": {
    chrome: "60",
    edge: "79",
    firefox: "55",
    safari: "11.1",
    node: "8.3",
    ios: "11.3",
    samsung: "8",
    opera: "47",
    electron: "2.1"
  },
  "transform-dotall-regex": {
    chrome: "62",
    edge: "79",
    safari: "11.1",
    node: "8.10",
    ios: "11.3",
    samsung: "8",
    opera: "49",
    electron: "3.1"
  },
  "proposal-unicode-property-regex": {
    chrome: "64",
    edge: "79",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    opera: "51",
    electron: "3.1"
  },
  "transform-named-capturing-groups-regex": {
    chrome: "64",
    edge: "79",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    opera: "51",
    electron: "3.1"
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
    samsung: "6",
    opera: "42",
    electron: "1.6"
  },
  "transform-async-to-generator": {
    chrome: "55",
    edge: "15",
    firefox: "52",
    safari: "11",
    node: "7.6",
    ios: "11",
    samsung: "6",
    opera: "42",
    electron: "1.6"
  },
  "transform-exponentiation-operator": {
    chrome: "52",
    edge: "14",
    firefox: "52",
    safari: "10.1",
    node: "7",
    ios: "10.3",
    samsung: "6",
    opera: "39",
    electron: "1.3"
  },
  "transform-template-literals": {
    chrome: "41",
    edge: "13",
    firefox: "34",
    safari: "13",
    node: "4",
    ios: "13",
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
    edge: "79",
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
    samsung: "1",
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
    samsung: "1",
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
    samsung: "1",
    electron: "0.2"
  }
};

// we could reuse this to get a list of polyfill
// using https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/built-ins.json#L1
// adding a featureNameArray to every group
// and according to that featureNameArray, add these polyfill
// to the generated bundle
const jsenvPluginCompatMap = {};

const computeBabelPluginMapForRuntime = ({
  babelPluginMap,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,
  runtimeName,
  runtimeVersion
}) => {
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`);
  }

  if (typeof babelPluginCompatMap !== "object") {
    throw new TypeError(`babelPluginCompatMap must be an object, got ${babelPluginCompatMap}`);
  }

  if (typeof runtimeName !== "string") {
    throw new TypeError(`runtimeName must be a string, got ${runtimeName}`);
  }

  if (typeof runtimeVersion !== "string") {
    throw new TypeError(`runtimeVersion must be a string, got ${runtimeVersion}`);
  }

  const babelPluginMapForRuntime = {};
  Object.keys(babelPluginMap).forEach(key => {
    const compatible = runtimeIsCompatibleWithFeature({
      runtimeName,
      runtimeVersion,
      runtimeCompatMap: key in babelPluginCompatMap ? babelPluginCompatMap[key] : {}
    });

    if (!compatible) {
      babelPluginMapForRuntime[key] = babelPluginMap[key];
    }
  });
  return babelPluginMapForRuntime;
};

const runtimeIsCompatibleWithFeature = ({
  runtimeName,
  runtimeVersion,
  runtimeCompatMap
}) => {
  const runtimeCompatibleVersion = computeRuntimeCompatibleVersion({
    runtimeCompatMap,
    runtimeName
  });
  const highestVersion = findHighestVersion(runtimeVersion, runtimeCompatibleVersion);
  return highestVersion === runtimeVersion;
};

const computeRuntimeCompatibleVersion = ({
  runtimeCompatMap,
  runtimeName
}) => {
  return runtimeName in runtimeCompatMap ? runtimeCompatMap[runtimeName] : "Infinity";
};

const computeJsenvPluginMapForRuntime = ({
  jsenvPluginMap,
  jsenvPluginCompatMap: jsenvPluginCompatMap$1 = jsenvPluginCompatMap,
  runtimeName,
  runtimeVersion
}) => {
  if (typeof jsenvPluginMap !== "object") {
    throw new TypeError(`jsenvPluginMap must be a object, got ${jsenvPluginMap}`);
  }

  if (typeof jsenvPluginCompatMap$1 !== "object") {
    throw new TypeError(`jsenvPluginCompatMap must be a string, got ${jsenvPluginCompatMap$1}`);
  }

  if (typeof runtimeName !== "string") {
    throw new TypeError(`runtimeName must be a string, got ${runtimeName}`);
  }

  if (typeof runtimeVersion !== "string") {
    throw new TypeError(`runtimeVersion must be a string, got ${runtimeVersion}`);
  }

  const jsenvPluginMapForRuntime = {};
  Object.keys(jsenvPluginMap).forEach(key => {
    const compatible = runtimeIsCompatibleWithFeature$1({
      runtimeName,
      runtimeVersion,
      featureCompat: key in jsenvPluginCompatMap$1 ? jsenvPluginCompatMap$1[key] : {}
    });

    if (!compatible) {
      jsenvPluginMapForRuntime[key] = jsenvPluginMap[key];
    }
  });
  return jsenvPluginMapForRuntime;
};

const runtimeIsCompatibleWithFeature$1 = ({
  runtimeName,
  runtimeVersion,
  featureCompat
}) => {
  const runtimeCompatibleVersion = computeRuntimeCompatibleVersion$1({
    featureCompat,
    runtimeName
  });
  const highestVersion = findHighestVersion(runtimeVersion, runtimeCompatibleVersion);
  return highestVersion === runtimeVersion;
};

const computeRuntimeCompatibleVersion$1 = ({
  featureCompat,
  runtimeName
}) => {
  return runtimeName in featureCompat ? featureCompat[runtimeName] : "Infinity";
};

const groupHaveSameRequirements = (leftGroup, rightGroup) => {
  return leftGroup.babelPluginRequiredNameArray.join("") === rightGroup.babelPluginRequiredNameArray.join("") && leftGroup.jsenvPluginRequiredNameArray.join("") === rightGroup.jsenvPluginRequiredNameArray.join("");
};

const generateRuntimeGroupArray = ({
  babelPluginMap,
  jsenvPluginMap,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,
  jsenvPluginCompatMap: jsenvPluginCompatMap$1 = jsenvPluginCompatMap,
  runtimeName
}) => {
  const versionArray = [];
  Object.keys(babelPluginMap).forEach(babelPluginKey => {
    if (babelPluginKey in babelPluginCompatMap) {
      const babelPluginCompat = babelPluginCompatMap[babelPluginKey];

      if (runtimeName in babelPluginCompat) {
        const version = String(babelPluginCompat[runtimeName]);

        if (!versionArray.includes(version)) {
          versionArray.push(version);
        }
      }
    }
  });
  Object.keys(jsenvPluginMap).forEach(jsenvPluginKey => {
    if (jsenvPluginKey in jsenvPluginCompatMap$1) {
      const jsenvPluginCompat = jsenvPluginCompatMap$1[jsenvPluginKey];

      if (runtimeName in jsenvPluginCompat) {
        const version = String(jsenvPluginCompat[runtimeName]);

        if (!versionArray.includes(version)) {
          versionArray.push(version);
        }
      }
    }
  });
  versionArray.push("0.0.0");
  versionArray.sort(versionCompare);
  const runtimeGroupArray = [];
  versionArray.forEach(version => {
    const babelPluginMapForRuntime = computeBabelPluginMapForRuntime({
      babelPluginMap,
      babelPluginCompatMap,
      runtimeName,
      runtimeVersion: version
    });
    const babelPluginRequiredNameArray = Object.keys(babelPluginMap).filter(babelPluginKey => babelPluginKey in babelPluginMapForRuntime).sort();
    const jsenvPluginMapForRuntime = computeJsenvPluginMapForRuntime({
      jsenvPluginMap,
      jsenvPluginCompatMap: jsenvPluginCompatMap$1,
      runtimeName,
      runtimeVersion: version
    });
    const jsenvPluginRequiredNameArray = Object.keys(jsenvPluginMap).filter(jsenvPluginKey => jsenvPluginKey in jsenvPluginMapForRuntime).sort();
    const group = {
      babelPluginRequiredNameArray,
      jsenvPluginRequiredNameArray,
      runtimeCompatMap: {
        [runtimeName]: version
      }
    };
    const groupWithSameRequirements = runtimeGroupArray.find(runtimeGroupCandidate => groupHaveSameRequirements(runtimeGroupCandidate, group));

    if (groupWithSameRequirements) {
      groupWithSameRequirements.runtimeCompatMap[runtimeName] = findHighestVersion(groupWithSameRequirements.runtimeCompatMap[runtimeName], version);
    } else {
      runtimeGroupArray.push(group);
    }
  });
  return runtimeGroupArray;
};

const composeRuntimeCompatMap = (runtimeCompatMap, secondRuntimeCompatMap) => {
  return objectComposeValue(normalizeRuntimeCompatMapVersions(runtimeCompatMap), normalizeRuntimeCompatMapVersions(secondRuntimeCompatMap), (version, secondVersion) => findHighestVersion(version, secondVersion));
};

const normalizeRuntimeCompatMapVersions = runtimeCompatibility => {
  return objectMapValue(runtimeCompatibility, version => String(version));
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
      groupWithSameRequirements.runtimeCompatMap = composeRuntimeCompatMap(groupWithSameRequirements.runtimeCompatMap, group.runtimeCompatMap);
    } else {
      reducedGroupArray.push(copyGroup(group));
    }
  });
  return reducedGroupArray;
};

const copyGroup = ({
  babelPluginRequiredNameArray,
  jsenvPluginRequiredNameArray,
  runtimeCompatMap
}) => {
  return {
    babelPluginRequiredNameArray: babelPluginRequiredNameArray.slice(),
    jsenvPluginRequiredNameArray: jsenvPluginRequiredNameArray.slice(),
    runtimeCompatMap: { ...runtimeCompatMap
    }
  };
};

const generateAllRuntimeGroupArray = ({
  babelPluginMap,
  jsenvPluginMap,
  babelPluginCompatMap,
  jsenvPluginCompatMap,
  runtimeNames
}) => {
  const arrayOfGroupArray = runtimeNames.map(runtimeName => generateRuntimeGroupArray({
    babelPluginMap,
    jsenvPluginMap,
    babelPluginCompatMap,
    jsenvPluginCompatMap,
    runtimeName
  }));
  const groupArray = composeGroupArray(...arrayOfGroupArray);
  return groupArray;
};

const runtimeCompatMapToScore = (runtimeCompatMap, runtimeScoreMap) => {
  return Object.keys(runtimeCompatMap).reduce((previous, runtimeName) => {
    const runtimeVersion = runtimeCompatMap[runtimeName];
    return previous + runtimeToScore(runtimeName, runtimeVersion, runtimeScoreMap);
  }, 0);
};

const runtimeToScore = (runtimeName, runtimeVersion, runtimeScoreMap) => {
  if (runtimeName in runtimeScoreMap === false) return runtimeScoreMap.other || 0;
  const versionUsageMap = runtimeScoreMap[runtimeName];
  const versionArray = Object.keys(versionUsageMap);
  if (versionArray.length === 0) return runtimeScoreMap.other || 0;
  const versionArrayAscending = versionArray.sort(versionCompare);
  const highestVersion = versionArrayAscending[versionArray.length - 1];
  if (findHighestVersion(runtimeVersion, highestVersion) === runtimeVersion) return versionUsageMap[highestVersion];
  const closestVersion = versionArrayAscending.reverse().find(version => findHighestVersion(runtimeVersion, version) === runtimeVersion);
  if (!closestVersion) return runtimeScoreMap.other || 0;
  return versionUsageMap[closestVersion];
};

/*

# featureCompatMap legend

        featureName
             │
{ ┌──────────┴────────────┐
  "transform-block-scoping": {─┐
    "chrome": "10",            │
    "safari": "3.0",           runTimeCompatMap
    "firefox": "5.1"           │
}────┼─────────┼───────────────┘
}    │         └─────┐
  runtimeName  runtimeVersion

# group legend

{
  "best": {
    "babelPluginRequiredNameArray" : [
      "transform-block-scoping",
    ],
    "runtimeCompatMap": {
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
  runtimeScoreMap,
  groupCount = 1,
  // pass this to true if you don't care if someone tries to run your code
  // on a runtime which is not inside runtimeScoreMap.
  runtimeAlwaysInsideRuntimeScoreMap = false,
  // pass this to true if you think you will always be able to detect
  // the runtime or that if you fail to do so you don't care.
  runtimeWillAlwaysBeKnown = false
}) => {
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`);
  }

  if (typeof jsenvPluginMap !== "object") {
    throw new TypeError(`jsenvPluginMap must be an object, got ${jsenvPluginMap}`);
  }

  if (typeof runtimeScoreMap !== "object") {
    throw new TypeError(`runtimeScoreMap must be an object, got ${runtimeScoreMap}`);
  }

  if (typeof groupCount < 1) {
    throw new TypeError(`groupCount must be above 1, got ${groupCount}`);
  }

  const groupWithoutFeature = {
    babelPluginRequiredNameArray: Object.keys(babelPluginMap),
    jsenvPluginRequiredNameArray: Object.keys(jsenvPluginMap),
    runtimeCompatMap: {}
  }; // when we create one group and we cannot ensure
  // code will be runned on a runtime inside runtimeScoreMap
  // then we return otherwise group to be safe

  if (groupCount === 1 && !runtimeAlwaysInsideRuntimeScoreMap) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature
    };
  }

  const allRuntimeGroupArray = generateAllRuntimeGroupArray({
    babelPluginMap,
    babelPluginCompatMap,
    jsenvPluginMap,
    jsenvPluginCompatMap,
    runtimeNames: arrayWithoutValue(Object.keys(runtimeScoreMap), "other")
  });

  if (allRuntimeGroupArray.length === 0) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature
    };
  }

  const groupToScore = ({
    runtimeCompatMap
  }) => runtimeCompatMapToScore(runtimeCompatMap, runtimeScoreMap);

  const allRuntimeGroupArraySortedByScore = allRuntimeGroupArray.sort((a, b) => groupToScore(b) - groupToScore(a));
  const length = allRuntimeGroupArraySortedByScore.length; // if we arrive here and want a single group
  // we take the worst group and consider it's our best group
  // because it's the lowest runtime we want to support

  if (groupCount === 1) {
    return {
      [COMPILE_ID_BEST]: allRuntimeGroupArraySortedByScore[length - 1]
    };
  }

  const addOtherwiseToBeSafe = !runtimeAlwaysInsideRuntimeScoreMap || !runtimeWillAlwaysBeKnown;
  const lastGroupIndex = addOtherwiseToBeSafe ? groupCount - 1 : groupCount;
  const groupArray = length + 1 > groupCount ? allRuntimeGroupArraySortedByScore.slice(0, lastGroupIndex) : allRuntimeGroupArraySortedByScore;
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

const proposalJSONStrings = require$1("@babel/plugin-proposal-json-strings");

const proposalObjectRestSpread = require$1("@babel/plugin-proposal-object-rest-spread");

const proposalOptionalCatchBinding = require$1("@babel/plugin-proposal-optional-catch-binding");

const proposalUnicodePropertyRegex = require$1("@babel/plugin-proposal-unicode-property-regex");

const syntaxObjectRestSpread = require$1("@babel/plugin-syntax-object-rest-spread");

const syntaxOptionalCatchBinding = require$1("@babel/plugin-syntax-optional-catch-binding");

const transformArrowFunction = require$1("@babel/plugin-transform-arrow-functions");

const transformAsyncToPromises = require$1("babel-plugin-transform-async-to-promises");

const transformBlockScopedFunctions = require$1("@babel/plugin-transform-block-scoped-functions");

const transformBlockScoping = require$1("@babel/plugin-transform-block-scoping");

const transformClasses = require$1("@babel/plugin-transform-classes");

const transformComputedProperties = require$1("@babel/plugin-transform-computed-properties");

const transformDestructuring = require$1("@babel/plugin-transform-destructuring");

const transformDotAllRegex = require$1("@babel/plugin-transform-dotall-regex");

const transformDuplicateKeys = require$1("@babel/plugin-transform-duplicate-keys");

const transformExponentiationOperator = require$1("@babel/plugin-transform-exponentiation-operator");

const transformForOf = require$1("@babel/plugin-transform-for-of");

const transformFunctionName = require$1("@babel/plugin-transform-function-name");

const transformLiterals = require$1("@babel/plugin-transform-literals");

const transformNewTarget = require$1("@babel/plugin-transform-new-target");

const transformObjectSuper = require$1("@babel/plugin-transform-object-super");

const transformParameters = require$1("@babel/plugin-transform-parameters");

const transformRegenerator = require$1("@babel/plugin-transform-regenerator");

const transformShorthandProperties = require$1("@babel/plugin-transform-shorthand-properties");

const transformSpread = require$1("@babel/plugin-transform-spread");

const transformStickyRegex = require$1("@babel/plugin-transform-sticky-regex");

const transformTemplateLiterals = require$1("@babel/plugin-transform-template-literals");

const transformTypeOfSymbol = require$1("@babel/plugin-transform-typeof-symbol");

const transformUnicodeRegex = require$1("@babel/plugin-transform-unicode-regex");

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
  projectDirectoryUrl,
  importMapFileRelativeUrl
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  const importMapForProject = importMapFileRelativeUrl ? await getProjectImportMap({
    projectDirectoryUrl,
    importMapFileRelativeUrl
  }) : null;
  const jsenvCoreImportKey = "@jsenv/core/";
  const jsenvCoreRelativeUrlForJsenvProject = projectDirectoryUrl === jsenvCoreDirectoryUrl ? "./" : urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl);
  const importsForJsenvCore = {
    [jsenvCoreImportKey]: jsenvCoreRelativeUrlForJsenvProject
  };

  if (!importMapForProject) {
    return {
      imports: importsForJsenvCore
    };
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
  const importMapFilePath = urlToFileSystemPath(importMapFileUrl);
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

const {
  addNamed
} = require$1("@babel/helper-module-imports");

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

const startsWithWindowsDriveLetter$1 = string => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = string[1];
  if (secondChar !== ":") return false;
  return true;
};
const windowsFilePathToUrl = windowsFilePath => {
  return `file:///${replaceBackSlashesWithSlashes$1(windowsFilePath)}`;
};
const replaceBackSlashesWithSlashes$1 = string => string.replace(/\\/g, "/");

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

const isWindows$4 = process.platform === "win32";
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
      sources.push(urlToRelativeUrl(originalFileUrl, metaJsonFileUrl));
      sourcesContent.push(originalFileContent);
    } else {
      await Promise.all(map.sources.map(async (source, index) => {
        // be careful here we might received C:/Directory/file.js path from babel
        // also in case we receive relative path like directory\file.js we replace \ with slash
        // for url resolution
        const sourceFileUrl = isWindows$4 && startsWithWindowsDriveLetter$1(source) ? windowsFilePathToUrl(source) : ensureWindowsDriveLetter(resolveUrl$1(isWindows$4 ? replaceBackSlashesWithSlashes$1(source) : source, sourcemapFileUrl), sourcemapFileUrl);

        if (!sourceFileUrl.startsWith(projectDirectoryUrl)) {
          // do not track dependency outside project
          // it means cache stays valid for those external sources
          return;
        }

        map.sources[index] = urlToRelativeUrl(sourceFileUrl, sourcemapFileUrl);
        sources[index] = urlToRelativeUrl(sourceFileUrl, metaJsonFileUrl);

        if (map.sourcesContent && map.sourcesContent[index]) {
          sourcesContent[index] = map.sourcesContent[index];
        } else {
          const sourceFileContent = await readFile(sourceFileUrl);
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
      const sourcemapFileRelativePathForModule = urlToRelativeUrl(sourcemapFileUrl, compiledFileUrl);
      output = writeSourceMappingURL(output, sourcemapFileRelativePathForModule);
      const sourcemapFileRelativePathForAsset = urlToRelativeUrl(sourcemapFileUrl, `${compiledFileUrl}__asset__/`);
      assets.push(sourcemapFileRelativePathForAsset);
      assetsContent.push(stringifyMap(map));
    }
  } else {
    sources.push(urlToRelativeUrl(originalFileUrl, metaJsonFileUrl));
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

  try {
    const metaJsonString = await readFile(metaJsonFileUrl);
    const metaJsonObject = JSON.parse(metaJsonString);
    return metaJsonObject;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    if (error && error.name === "SyntaxError") {
      logger.error(createCacheSyntaxErrorMessage({
        syntaxError: error,
        metaJsonFileUrl
      }));
      return null;
    }

    throw error;
  }
};

const createCacheSyntaxErrorMessage = ({
  syntaxError,
  metaJsonFileUrl
}) => `cache syntax error
--- syntax error stack ---
${syntaxError.stack}
--- meta.json path ---
${urlToFileSystemPath(metaJsonFileUrl)}`;

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
  try {
    const compiledSource = await readFile(compiledFileUrl);

    if (ifEtagMatch) {
      const compiledEtag = bufferToEtag(Buffer.from(compiledSource));

      if (ifEtagMatch !== compiledEtag) {
        logger.debug(`etag changed for ${urlToFileSystemPath(compiledFileUrl)}`);
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
      const compiledMtime = await readFileSystemNodeModificationTime(compiledFileUrl);

      if (ifModifiedSinceDate < dateToSecondsPrecision$1(compiledMtime)) {
        logger.debug(`mtime changed for ${urlToFileSystemPath(compiledFileUrl)}`);
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
      logger.debug(`compiled file not found at ${urlToFileSystemPath(compiledFileUrl)}`);
      return {
        code: "COMPILED_FILE_NOT_FOUND",
        valid: false,
        data: {
          compiledFileUrl
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

  try {
    const sourceContent = await readFile(sourceFileUrl);
    const sourceETag = bufferToEtag(Buffer.from(sourceContent));

    if (sourceETag !== eTag) {
      logger.debug(`etag changed for ${urlToFileSystemPath(sourceFileUrl)}`);
      return {
        code: "SOURCE_ETAG_MISMATCH",
        valid: false,
        data: {
          source,
          sourceFileUrl,
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
      logger.warn(`source not found at ${sourceFileUrl}`);
      return {
        code: "SOURCE_NOT_FOUND",
        valid: false,
        data: {
          source,
          sourceFileUrl,
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

  try {
    const assetContent = await readFile(assetFileUrl);
    const assetContentETag = bufferToEtag(Buffer.from(assetContent));

    if (eTag !== assetContentETag) {
      logger.debug(`etag changed for ${urlToFileSystemPath(assetFileUrl)}`);
      return {
        code: "ASSET_ETAG_MISMATCH",
        valid: false,
        data: {
          asset,
          assetFileUrl,
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
      logger.debug(`asset not found at ${urlToFileSystemPath(assetFileUrl)}`);
      return {
        code: "ASSET_FILE_NOT_FOUND",
        valid: false,
        data: {
          asset,
          assetFileUrl
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
    const sourceStats = await readFileSystemNodeStat(sourceFileUrl, {
      nullIfNotFound: true
    });

    if (sourceStats === null) {
      // this can lead to cache never invalidated by itself
      // it's a very important warning
      logger.warn(`a source file cannot be found ${sourceFileUrl}.
-> excluding it from meta.sources & meta.sourcesEtag`);
      return false;
    }

    return true;
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
      logger.debug(`write compiled file at ${urlToFileSystemPath(compiledFileUrl)}`);
      promises.push(writeFile(compiledFileUrl, compiledSource));
    }

    if (writeAssetsFile) {
      promises.push(...assets.map((asset, index) => {
        const assetFileUrl = resolveAssetFileUrl({
          compiledFileUrl,
          asset
        });
        logger.debug(`write compiled file asset at ${urlToFileSystemPath(assetFileUrl)}`);
        return writeFile(assetFileUrl, assetsContent[index]);
      }));
    }
  }

  if (isNew || isUpdated || isCached && cacheHitTracking) {
    let latestMeta;

    if (isNew) {
      latestMeta = {
        contentType,
        sources,
        sourcesEtag: sourcesContent.map(sourceContent => bufferToEtag(Buffer.from(sourceContent))),
        assets,
        assetsEtag: assetsContent.map(assetContent => bufferToEtag(Buffer.from(assetContent))),
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
        sourcesEtag: sourcesContent.map(sourceContent => bufferToEtag(Buffer.from(sourceContent))),
        assets,
        assetsEtag: assetsContent.map(assetContent => bufferToEtag(Buffer.from(assetContent))),
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
    logger.debug(`write compiled file meta at ${urlToFileSystemPath(metaJsonFileUrl)}`);
    promises.push(writeFile(metaJsonFileUrl, JSON.stringify(latestMeta, null, "  ")));
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

const lockfile = require$1("proper-lockfile");

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
  const metaJsonFilePath = urlToFileSystemPath(metaJsonFileUrl);
  logger.debug(`lock ${metaJsonFilePath}`); // in case this process try to concurrently access meta we wait for previous to be done

  const unlockLocal = await lockForRessource(metaJsonFilePath);

  let unlockInterProcessLock = () => {};

  if (cacheInterProcessLocking) {
    // after that we use a lock pathnameRelative to be sure we don't conflict with other process
    // trying to do the same (mapy happen when spawining multiple server for instance)
    // https://github.com/moxystudio/node-proper-lockfile/issues/69
    await ensureParentDirectories(metaJsonFilePath); // https://github.com/moxystudio/node-proper-lockfile#lockfile-options

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
          "eTag": bufferToEtag(Buffer.from(compiledSource))
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
      const relativeUrl = urlToRelativeUrl(fileSystemPathToUrl(error.data.filename), projectDirectoryUrl);
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

https.globalAgent.options.rejectUnauthorized = false;
const fetchUrl$1 = async (url, {
  simplified = true,
  ignoreHttpsError = true,
  ...rest
} = {}) => {
  return fetchUrl(url, {
    simplified,
    ignoreHttpsError,
    ...rest
  });
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
  const sourcemapResponse = await fetchUrl$1(sourcemapUrl, {
    cancellationToken,
    ignoreHttpsError: true
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
  minify
} = require$1("html-minifier");

const minifyHtml = (htmlString, options) => {
  return minify(htmlString, options);
};

const {
  minify: minify$1
} = require$1("terser");

const minifyJs = (jsString, options) => {
  return minify$1(jsString, options);
};

const CleanCSS = require$1("clean-css");

const minifyCss = (cssString, options) => {
  return new CleanCSS(options).minify(cssString).styles;
};

/* eslint-disable import/max-dependencies */
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
  // https://github.com/terser/terser#minify-options
  minifyJsOptions,
  // https://github.com/jakubpawlowicz/clean-css#constructor-options
  minifyCssOptions,
  // https://github.com/kangax/html-minifier#options-quick-reference
  minifyHtmlOptions,
  manifestFile,
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
      if (isFileSystemPath(importer)) {
        importer = fileSystemPathToUrl(importer);
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
      const bundleSourcemapFileUrl = resolveUrl$1(`./${chunkId}.map`, bundleDirectoryUrl); // options.sourcemapFile = bundleSourcemapFileUrl

      const relativePathToUrl = relativePath => {
        const rollupUrl = resolveUrl$1(relativePath, bundleSourcemapFileUrl);
        let url; // fix rollup not supporting source being http

        const httpIndex = rollupUrl.indexOf(`http:/`);

        if (httpIndex > -1) {
          url = `http://${rollupUrl.slice(httpIndex + `http:/`.length)}`;
        } else {
          const httpsIndex = rollupUrl.indexOf("https:/");

          if (httpsIndex > -1) {
            url = `https://${rollupUrl.slice(httpsIndex + `https:/`.length)}`;
          } else {
            url = rollupUrl;
          }
        }

        if (url in redirectionMap) {
          return redirectionMap[url];
        }

        return url;
      };

      options.sourcemapPathTransform = relativePath => {
        const url = relativePathToUrl(relativePath);

        if (url.startsWith(compileServerOrigin)) {
          const relativeUrl = url.slice(`${compileServerOrigin}/`.length);
          const fileUrl = `${projectDirectoryUrl}${relativeUrl}`;
          relativePath = urlToRelativeUrl(fileUrl, bundleSourcemapFileUrl);
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

      const result = minifyJs(source, {
        sourceMap: true,
        ...(format === "global" ? {
          toplevel: false
        } : {
          toplevel: true
        }),
        ...minifyJsOptions
      });

      if (result.error) {
        throw result.error;
      } else {
        return result;
      }
    },
    generateBundle: async (outputOptions, bundle) => {
      if (!manifestFile) {
        return;
      }

      const mappings = {};
      Object.keys(bundle).forEach(key => {
        const chunk = bundle[key];
        mappings[`${chunk.name}.js`] = chunk.fileName;
      });
      const mappingKeysSorted = Object.keys(mappings).sort(comparePathnames);
      const manifest = {};
      mappingKeysSorted.forEach(key => {
        manifest[key] = mappings[key];
      });
      const manifestFileUrl = resolveUrl$1("manifest.json", bundleDirectoryUrl);
      await writeFile(manifestFileUrl, JSON.stringify(manifest, null, "  "));
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
      return {
        responseUrl,
        contentRaw: content,
        content: jsonToJavascript(content)
      };
    }

    if (contentType === "text/html") {
      return {
        responseUrl,
        contentRaw: content,
        content: htmlToJavascript(content)
      };
    }

    if (contentType === "text/css") {
      return {
        responseUrl,
        contentRaw: content,
        content: cssToJavascript(content)
      };
    }

    if (!contentType.startsWith("text/")) {
      logger.warn(`unexpected content-type for module.
--- content-type ---
${contentType}
--- expected content-types ---
"application/javascript"
"application/json"
"text/*"
--- module url ---
${moduleUrl}`);
    } // fallback to text


    return {
      responseUrl,
      contentRaw: content,
      content: textToJavascript(content)
    };
  };

  const jsonToJavascript = jsonString => {
    // there is no need to minify the json string
    // because it becomes valid javascript
    // that will be minified by minifyJs inside renderChunk
    return `export default ${jsonString}`;
  };

  const htmlToJavascript = htmlString => {
    if (minify) {
      htmlString = minifyHtml(htmlString, minifyHtmlOptions);
    }

    return `export default ${JSON.stringify(htmlString)}`;
  };

  const cssToJavascript = cssString => {
    if (minify) {
      cssString = minifyCss(cssString, minifyCssOptions);
    }

    return `export default ${JSON.stringify(cssString)}`;
  };

  const textToJavascript = textString => {
    return `export default ${JSON.stringify(textString)}`;
  };

  const getModule = async moduleUrl => {
    const response = await fetchUrl$1(moduleUrl, {
      cancellationToken,
      ignoreHttpsError: true
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
//     return urlToFileSystemPath(`${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`)
//   }
//   if (url.startsWith("file://")) {
//     return urlToFileSystemPath(url)
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
    const bundleFileUrl = resolveUrl$1(bundleFilename, bundleDirectoryUrl);
    const {
      code,
      map
    } = await transformJs({
      projectDirectoryUrl,
      code: bundleInfo.code,
      url: bundleFileUrl,
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
    await Promise.all([writeFile(bundleFileUrl, writeSourceMappingURL(code, `./${bundleFilename}.map`)), writeFile(`${bundleFileUrl}.map`, JSON.stringify(map))]);
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
} = require$1("rollup");

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
  formatInputOptions,
  formatOutputOptions,
  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,
  sourcemapExcludeSources,
  writeOnFileSystem,
  manifestFile = false
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
    minify,
    minifyJsOptions,
    minifyCssOptions,
    minifyHtmlOptions,
    manifestFile
  });
  const rollupBundle = await useRollup({
    cancellationToken,
    logger,
    entryPointMap,
    node,
    browser,
    jsenvRollupPlugin,
    format,
    formatInputOptions,
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
  formatInputOptions,
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
      //  experimentalTopLevelAwait: true,
      // if we want to ignore some warning
      // please use https://rollupjs.org/guide/en#onwarn
      // to be very clear about what we want to ignore
      onwarn: (warning, warn) => {
        if (warning.code === "THIS_IS_UNDEFINED") return;
        warn(warning);
      },
      input: entryPointMap,
      external: id => nativeModulePredicate(id),
      plugins: [jsenvRollupPlugin],
      ...formatInputOptions
    })
  });

  if (!formatOutputOptions.entryFileNames) {
    formatOutputOptions.entryFileNames = `[name]${path.extname(entryPointMap[Object.keys(entryPointMap)[0]])}`;
  }

  if (!formatOutputOptions.chunkFileNames) {
    formatOutputOptions.chunkFileNames = `[name]-[hash]${path.extname(entryPointMap[Object.keys(entryPointMap)[0]])}`;
  }

  const rollupGenerateOptions = {
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    // experimentalTopLevelAwait: true,
    // we could put prefConst to true by checking 'transform-block-scoping'
    // presence in babelPluginMap
    preferConst: false,
    // https://rollupjs.org/guide/en#output-dir
    dir: urlToFileSystemPath(bundleDirectoryUrl),
    // https://rollupjs.org/guide/en#output-format
    format: formatToRollupFormat(format),
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
  if (format === "esm") return "esm";
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

      const relativeUrl = urlToRelativeUrl(moduleUrl, `${compiledFileUrl}__asset__/meta.json`);

      if (!sources.includes(relativeUrl)) {
        sources.push(relativeUrl);
        sourcesContent.push(dependencyMap[moduleUrl].contentRaw);
      }
    });
  };

  const assets = [];
  const assetsContent = [];
  const mainChunk = parseRollupChunk(rollupBundle.output[0], {
    moduleContentMap,
    sourcemapFileUrl,
    sourcemapFileRelativeUrlForModule: urlToRelativeUrl(sourcemapFileUrl, compiledFileUrl)
  }); // mainChunk.sourcemap.file = fileUrlToRelativePath(originalFileUrl, sourcemapFileUrl)

  trackDependencies(mainChunk.dependencyMap);
  assets.push(urlToRelativeUrl(sourcemapFileUrl, `${compiledFileUrl}__asset__/`));
  assetsContent.push(JSON.stringify(mainChunk.sourcemap, null, "  "));
  rollupBundle.output.slice(1).forEach(rollupChunk => {
    const chunkFileName = rollupChunk.fileName;
    const chunk = parseRollupChunk(rollupChunk, {
      moduleContentMap,
      compiledFileUrl,
      sourcemapFileUrl: resolveUrl$1(rollupChunk.map.file, compiledFileUrl)
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
    const moduleFilePath = urlToFileSystemPath(moduleUrl); // this could be async but it's ok for now
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
      const code = await readFile(originalFileUrl);
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
  compileServerProtocol = "https",
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp = "127.0.0.1",
  compileServerPort = 0,
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
  runtimeAlwaysInsideRuntimeScoreMap = false,
  coverageConfig
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
    runtimeScoreMap: { ...browserScoreMap,
      node: nodeVersionScoreMap
    },
    groupCount: compileGroupCount,
    runtimeAlwaysInsideRuntimeScoreMap
  });
  const outDirectoryMeta = {
    babelPluginMap,
    convertMap,
    groupMap,
    coverageConfig
  };

  if (jsenvDirectoryClean) {
    logger.info(`clean jsenv directory at ${jsenvDirectoryUrl}`);
    await ensureEmptyDirectory(jsenvDirectoryUrl);
  }

  if (useFilesystemAsCache) {
    await cleanOutDirectoryIfObsolete({
      logger,
      outDirectoryUrl,
      outDirectoryMeta
    });
  }

  const packageFileUrl = resolveUrl$1("./package.json", jsenvCoreDirectoryUrl);
  const packageFilePath = urlToFileSystemPath(packageFileUrl);
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
    serverName: "compile server",
    protocol: compileServerProtocol,
    privateKey: compileServerPrivateKey,
    certificate: compileServerCertificate,
    ip: compileServerIp,
    port: compileServerPort,
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
    outDirectoryRelativeUrl,
    importMapFileRelativeUrl
  })]);
  env = { ...env,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension
  };

  const importMapToString = () => JSON.stringify(importMapForCompileServer, null, "  ");

  const groupMapToString = () => JSON.stringify(groupMap, null, "  ");

  const envToString = () => JSON.stringify(env, null, "  ");

  const importMapOutFileUrl = resolveUrl$1("./importMap.json", outDirectoryUrl);
  const groupMapOutFileUrl = resolveUrl$1("./groupMap.json", outDirectoryUrl);
  const envOutFileUrl = resolveUrl$1("./env.json", outDirectoryUrl);
  await Promise.all([writeFile(importMapOutFileUrl, importMapToString()), writeFile(groupMapOutFileUrl, groupMapToString()), writeFile(envOutFileUrl, envToString())]);

  if (!writeOnFilesystem) {
    compileServer.stoppedPromise.then(() => {
      removeFileSystemNode(importMapOutFileUrl, {
        allowUseless: true
      });
      removeFileSystemNode(groupMapOutFileUrl, {
        allowUseless: true
      });
      removeFileSystemNode(envOutFileUrl);
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
  const filePath = urlToFileSystemPath(fileUrl);
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
  outDirectoryRelativeUrl,
  importMapFileRelativeUrl
}) => {
  const importMapForJsenvCore = await generateImportMapForPackage({
    logger,
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    rootProjectDirectoryUrl: projectDirectoryUrl,
    includeImports: true,
    includeExports: true
  });
  const importMapInternal = {
    imports: { ...(outDirectoryRelativeUrl === ".jsenv/out/" ? {} : {
        "/.jsenv/out/": `./${outDirectoryRelativeUrl}`
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
    projectDirectoryUrl,
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
  const jsenvCorePackageFilePath = urlToFileSystemPath(jsenvCorePackageFileUrl);
  const jsenvCorePackageVersion = readPackage(jsenvCorePackageFilePath).version;
  outDirectoryMeta = { ...outDirectoryMeta,
    jsenvCorePackageVersion
  };
  const metaFileUrl = resolveUrl$1("./meta.json", outDirectoryUrl);
  let previousOutDirectoryMeta;

  try {
    const source = await readFile(metaFileUrl);
    previousOutDirectoryMeta = JSON.parse(source);
  } catch (e) {
    if (e && e.code === "ENOENT") {
      previousOutDirectoryMeta = null;
    } else {
      throw e;
    }
  }

  if (previousOutDirectoryMeta !== null && JSON.stringify(previousOutDirectoryMeta) !== JSON.stringify(outDirectoryMeta)) {
    logger.info(`clean out directory at ${urlToFileSystemPath(outDirectoryUrl)}`);
    await ensureEmptyDirectory(outDirectoryUrl);
  }

  await writeFile(metaFileUrl, JSON.stringify(outDirectoryMeta, null, "  "));
};

const {
  createFileCoverage
} = require$1("istanbul-lib-coverage"); // https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43


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
  // stopAfterExecute false by default because you want to keep browser alive
  // or nodejs process
  // however unit test will pass true because they want to move on
  stopAfterExecute = false,
  stopAfterExecuteReason = "stop after execute",
  // when launch returns { disconnected, gracefulStop, stop }
  // the launched runtime have that amount of ms for disconnected to resolve
  // before we call stop
  gracefulStopAllocatedMs = 4000,
  runtimeConsoleCallback = () => {},
  runtimeStartedCallback = () => {},
  runtimeStoppedCallback = () => {},
  runtimeErrorCallback = () => {},
  runtimeDisconnectCallback = () => {},
  measureDuration = false,
  mirrorConsole = false,
  captureConsole = false,
  // rename collectConsole ?
  collectRuntimeName = false,
  collectRuntimeVersion = false,
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
    runtimeConsoleCallback = composeCallback(runtimeConsoleCallback, ({
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
    runtimeConsoleCallback = composeCallback(runtimeConsoleCallback, ({
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

  if (collectRuntimeName) {
    runtimeStartedCallback = composeCallback(runtimeStartedCallback, ({
      name
    }) => {
      executionResultTransformer = composeTransformer(executionResultTransformer, executionResult => {
        executionResult.runtimeName = name;
        return executionResult;
      });
    });
  }

  if (collectRuntimeVersion) {
    runtimeStartedCallback = composeCallback(runtimeStartedCallback, ({
      version
    }) => {
      executionResultTransformer = composeTransformer(executionResultTransformer, executionResult => {
        executionResult.runtimeVersion = version;
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
    stopAfterExecute,
    stopAfterExecuteReason,
    gracefulStopAllocatedMs,
    runtimeConsoleCallback,
    runtimeErrorCallback,
    runtimeDisconnectCallback,
    runtimeStartedCallback,
    runtimeStoppedCallback,
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
  stopAfterExecute,
  stopAfterExecuteReason,
  gracefulStopAllocatedMs,
  runtimeStartedCallback,
  runtimeStoppedCallback,
  runtimeConsoleCallback,
  runtimeErrorCallback,
  runtimeDisconnectCallback,
  ...rest
}) => {
  launchLogger.debug(`launch execution for ${fileRelativeUrl}`);
  const launchOperation = createStoppableOperation({
    cancellationToken,
    start: async () => {
      const value = await launch({
        cancellationToken,
        logger: launchLogger,
        ...rest
      });
      runtimeStartedCallback({
        name: value.name,
        version: value.version
      });
      return value;
    },
    stop: async (runtime, reason) => {
      // external code can cancel using cancellationToken at any time.
      // (livereloading note: we would do that and listen for stoppedCallback before restarting an operation)
      // it is important to keep the code inside this stop function because once cancelled
      // all code after the operation won't execute because it will be rejected with
      // the cancellation error
      let gracefulStop;

      if (runtime.gracefulStop && gracefulStopAllocatedMs) {
        launchLogger.debug(`${fileRelativeUrl} gracefulStop() because ${reason}`);

        const gracefulStopPromise = (async () => {
          await runtime.gracefulStop({
            reason
          });
          return true;
        })();

        const stopPromise = (async () => {
          const gracefulStop = await new Promise(async resolve => {
            const timeoutId = setTimeout(resolve, gracefulStopAllocatedMs);

            try {
              await gracefulStopPromise;
            } finally {
              clearTimeout(timeoutId);
            }
          });

          if (gracefulStop) {
            return gracefulStop;
          }

          launchLogger.debug(`${fileRelativeUrl} gracefulStop() pending after ${gracefulStopAllocatedMs}ms, use stop()`);
          await runtime.stop({
            reason,
            gracefulFailed: true
          });
          return false;
        })();

        gracefulStop = await Promise.race([gracefulStopPromise, stopPromise]);
      } else {
        await runtime.stop({
          reason,
          gracefulFailed: false
        });
        gracefulStop = false;
      }

      runtimeStoppedCallback({
        gracefulStop
      });
      launchLogger.debug(`${fileRelativeUrl} runtime stopped`);
    }
  });
  const {
    name: runtimeName,
    version: runtimeVersion,
    options,
    executeFile,
    registerErrorCallback,
    registerConsoleCallback,
    disconnected
  } = await launchOperation;
  const runtime = `${runtimeName}/${runtimeVersion}`;
  launchLogger.debug(`${runtime} started.
--- options ---
options: ${JSON.stringify(options, null, "  ")}`);
  registerConsoleCallback(runtimeConsoleCallback);
  executeLogger.debug(`${fileRelativeUrl} ${runtime}: start execution`);
  const executeOperation = createOperation({
    cancellationToken,
    start: async () => {
      let timing = TIMING_BEFORE_EXECUTION;
      disconnected.then(() => {
        executeLogger.debug(`${fileRelativeUrl} ${runtime}: disconnected ${timing}.`);
        runtimeDisconnectCallback({
          timing
        });
      });
      const executed = executeFile(fileRelativeUrl, rest);
      timing = TIMING_DURING_EXECUTION;
      registerErrorCallback(error => {
        executeLogger.error(`${fileRelativeUrl} ${runtime}: error ${timing}.
--- error stack ---
${error.stack}`);
        runtimeErrorCallback({
          error,
          timing
        });
      });
      const raceResult = await promiseTrackRace([disconnected, executed]);
      timing = TIMING_AFTER_EXECUTION;

      if (raceResult.winner === disconnected) {
        return createDisconnectedExecutionResult();
      }

      if (stopAfterExecute) {
        launchOperation.stop(stopAfterExecuteReason);
      }

      const executionResult = raceResult.value;
      const {
        status
      } = executionResult;

      if (status === "errored") {
        executeLogger.error(`${fileRelativeUrl} ${runtime}: error ${timing}.
--- error stack ---
${executionResult.error.stack}`);
        return createErroredExecutionResult(executionResult, rest);
      }

      executeLogger.debug(`${fileRelativeUrl} ${runtime}: execution completed.`);
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
  cancellationToken = createCancellationTokenForProcess(),
  logLevel = "warn",
  compileServerLogLevel = logLevel,
  launchLogLevel = logLevel,
  executeLogLevel = logLevel,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  fileRelativeUrl,
  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap,
  convertMap,
  compileGroupCount = 2,
  launch,
  mirrorConsole = true,
  stopAfterExecute = false,
  gracefulStopAllocatedMs,
  updateProcessExitCode = true,
  ...rest
}) => {
  return catchCancellation(async () => {
    const launchLogger = createLogger({
      logLevel: launchLogLevel
    });
    const executeLogger = createLogger({
      logLevel: executeLogLevel
    });
    projectDirectoryUrl = assertProjectDirectoryUrl({
      projectDirectoryUrl
    });
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

    const {
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
      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      babelPluginMap,
      convertMap,
      compileGroupCount
    });
    return launchAndExecute({
      cancellationToken,
      launchLogger,
      executeLogger,
      fileRelativeUrl,
      launch: params => launch({
        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        compileServerOrigin,
        ...params
      }),
      mirrorConsole,
      stopAfterExecute,
      gracefulStopAllocatedMs,
      ...rest
    });
  }).then(result => {
    if (result.status === "errored") {
      // unexpected execution error
      // -> update process.exitCode by default
      // (we can disable this for testing)
      if (updateProcessExitCode) {
        process.exitCode = 1;
      }

      throw result.error;
    }

    return result;
  }, e => {
    // unexpected internal error
    // -> always updates process.exitCode
    process.exitCode = 1;
    throw e;
  });
};

const {
  programVisitor
} = require$1("istanbul-lib-instrument"); // https://github.com/istanbuljs/babel-plugin-istanbul/blob/321740f7b25d803f881466ea819d870f7ed6a254/src/index.js


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
    directoryUrl: projectDirectoryUrl,
    specifierMetaMap,
    predicate: ({
      filePlan
    }) => filePlan
  });
  const executionSteps = [];
  fileResultArray.forEach(({
    relativeUrl,
    meta
  }) => {
    const fileExecutionSteps = generateFileExecutionSteps({
      fileRelativeUrl: relativeUrl,
      filePlan: meta.filePlan
    });
    executionSteps.push(...fileExecutionSteps);
  });
  return executionSteps;
};

const startCompileServerForExecutingPlan = async ({
  // false because don't know if user is going
  // to use both node and browser
  browserRuntimeAnticipatedGeneration = false,
  nodeRuntimeAnticipatedGeneration = false,
  ...rest
}) => {
  const compileServer = await startCompileServer(rest);
  const promises = [];

  if (browserRuntimeAnticipatedGeneration) {
    promises.push(fetchUrl$1(`${compileServer.origin}/${compileServer.outDirectoryRelativeUrl}otherwise-global-bundle/src/browserRuntime.js`, {
      ignoreHttpsError: true
    }));
  }

  if (nodeRuntimeAnticipatedGeneration) {
    promises.push(fetchUrl$1(`${compileServer.origin}/${compileServer.outDirectoryRelativeUrl}otherwise-commonjs-bundle/src/nodeRuntime.js`, {
      ignoreHttpsError: true
    }));
  }

  await Promise.all(promises);
  return compileServer;
};

const {
  createFileCoverage: createFileCoverage$1
} = require$1("istanbul-lib-coverage");

const createEmptyCoverage = relativeUrl => createFileCoverage$1(relativeUrl).toJSON();

const syntaxDynamicImport$1 = require$1("@babel/plugin-syntax-dynamic-import");

const syntaxImportMeta$1 = require$1("@babel/plugin-syntax-import-meta");

const {
  transformAsync: transformAsync$1
} = require$1("@babel/core");

const relativeUrlToEmptyCoverage = async (relativeUrl, {
  cancellationToken,
  projectDirectoryUrl,
  babelPluginMap
}) => {
  const fileUrl = resolveUrl$1(relativeUrl, projectDirectoryUrl);
  const source = await createOperation({
    cancellationToken,
    start: () => readFile(fileUrl)
  }); // we must compile to get the coverage object
  // without evaluating the file because it would increment coverage
  // and execute code that can be doing anything

  try {
    const {
      metadata
    } = await createOperation({
      cancellationToken,
      start: () => transformAsync$1(source, {
        filename: urlToFileSystemPath(fileUrl),
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

const ensureRelativePathsInCoverage = coverageMap => {
  const coverageMapRelative = {};
  Object.keys(coverageMap).forEach(key => {
    const coverageForFile = coverageMap[key];
    coverageMapRelative[key] = coverageForFile.path.startsWith("./") ? coverageForFile : { ...coverageForFile,
      path: `./${coverageForFile.path}`
    };
  });
  return coverageMapRelative;
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
    return ensureRelativePathsInCoverage(coverageMapForReport);
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
  return ensureRelativePathsInCoverage({ ...coverageMapForReport,
    ...coverageMapForMissedFiles
  });
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
    directoryUrl: projectDirectoryUrl,
    specifierMetaMap: specifierMetaMapForCoverage,
    predicate: ({
      cover
    }) => cover
  });
  return matchingFileResultArray.map(({
    relativeUrl
  }) => relativeUrl);
};

const executionReportToCoverageMap = report => {
  const coverageMapArray = [];
  Object.keys(report).forEach(file => {
    const executionResultForFile = report[file];
    Object.keys(executionResultForFile).forEach(executionName => {
      const executionResultForFileOnRuntime = executionResultForFile[executionName];
      const {
        coverageMap
      } = executionResultForFileOnRuntime;

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

const stringWidth = require$1("string-width");

const writeLog = (string, {
  stream = process.stdout
} = {}) => {
  stream.write(`${string}
`);
  const remove = memoize(() => {
    const {
      columns = 80
    } = stream;
    const logLines = string.split(/\r\n|\r|\n/);
    let visualLineCount = 0;
    logLines.forEach(logLine => {
      const width = stringWidth(logLine);
      visualLineCount += width === 0 ? 1 : Math.ceil(width / columns);
    });

    while (visualLineCount--) {
      readline.cursorTo(stream, 0);
      readline.clearLine(stream, 0);
      readline.moveCursor(stream, 0, -1);
    }
  });
  let updated = false;

  const update = newString => {
    if (updated) {
      throw new Error(`cannot update twice`);
    }

    updated = true;

    {
      remove();
    }

    return writeLog(newString, {
      stream
    });
  };

  return {
    remove,
    update
  };
};

const cross = "☓"; // "\u2613"

const checkmark = "✔"; // "\u2714"

const yellow$1 = "\x1b[33m";
const magenta$1 = "\x1b[35m";
const red$1 = "\x1b[31m";
const green$1 = "\x1b[32m";
const grey = "\x1b[39m";
const ansiResetSequence = "\x1b[0m";

const humanizeDuration = require$1("humanize-duration");

const formatDuration = duration => {
  return humanizeDuration(duration, {
    largest: 2,
    maxDecimalPoints: 2
  });
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
  })}.`;
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

const createAllDisconnectedDetails = () => `all ${magenta$1}disconnected${ansiResetSequence}`;

const createAllTimedoutDetails = () => `all ${yellow$1}timedout${ansiResetSequence}`;

const createAllErroredDetails = () => `all ${red$1}errored${ansiResetSequence}`;

const createAllCompletedDetails = () => `all ${green$1}completed${ansiResetSequence}`;

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

  return `${parts.join(", ")}`;
};

const createTotalDurationMessage = ({
  startMs,
  endMs
}) => {
  if (!endMs) return "";
  return `
total duration: ${formatDuration(endMs - startMs)}`;
};

const createExecutionResultLog = ({
  status,
  fileRelativeUrl,
  allocatedMs,
  runtimeName,
  runtimeVersion,
  consoleCalls,
  startMs,
  endMs,
  error,
  executionIndex
}, {
  completedExecutionLogAbbreviation,
  executionCount,
  disconnectedCount,
  timedoutCount,
  erroredCount,
  completedCount
}) => {
  const executionNumber = executionIndex + 1;
  const summary = `(${createSummaryDetails({
    executionCount: executionNumber,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount
  })})`;
  const runtime = `${runtimeName}/${runtimeVersion}`;

  if (status === "completed") {
    if (completedExecutionLogAbbreviation) {
      return `
${green$1}${checkmark} execution ${executionNumber} of ${executionCount} completed${ansiResetSequence} ${summary}.`;
    }

    return `
${green$1}${checkmark} execution ${executionNumber} of ${executionCount} completed${ansiResetSequence} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
      startMs,
      endMs
    })}${appendConsole(consoleCalls)}${appendError(error)}`;
  }

  if (status === "disconnected") {
    return `
${magenta$1}${cross} execution ${executionNumber} of ${executionCount} disconnected${ansiResetSequence} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
      startMs,
      endMs
    })}${appendConsole(consoleCalls)}${appendError(error)}`;
  }

  if (status === "timedout") {
    return `
${yellow$1}${cross} execution ${executionNumber} of ${executionCount} timeout after ${allocatedMs}ms${ansiResetSequence} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
      startMs,
      endMs
    })}${appendConsole(consoleCalls)}${appendError(error)}`;
  }

  return `
${red$1}${cross} execution ${executionNumber} of ${executionCount} error${ansiResetSequence} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
    startMs,
    endMs
  })}${appendConsole(consoleCalls)}${appendError(error)}`;
};

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
${grey}-------- console --------${ansiResetSequence}
${consoleOutputTrimmed}
${grey}-------------------------${ansiResetSequence}`;
};

const appendError = error => {
  if (!error) return ``;
  return `
error: ${error.stack}`;
};

/* eslint-disable import/max-dependencies */

const wrapAnsi = require$1("wrap-ansi");

const executeConcurrently = async (executionSteps, {
  cancellationToken,
  logger,
  launchLogger,
  executeLogger,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  babelPluginMap,
  concurrencyLimit = Math.max(os.cpus.length - 1, 1),
  executionDefaultOptions = {},
  stopAfterExecute,
  logSummary,
  completedExecutionLogMerging,
  completedExecutionLogAbbreviation,
  coverage,
  coverageConfig,
  coverageIncludeMissing,
  ...rest
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
    collectRuntimeName: true,
    collectRuntimeVersion: true,
    collectNamespace: false,
    collectCoverage: coverage,
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
  const startMs = Date.now();
  const allExecutionDoneCancellationSource = createCancellationSource();
  const executionCancellationToken = composeCancellationToken(cancellationToken, allExecutionDoneCancellationSource.token);
  const report = {};
  const executionCount = executionSteps.length;
  let previousExecutionResult;
  let previousExecutionLog;
  let disconnectedCount = 0;
  let timedoutCount = 0;
  let erroredCount = 0;
  let completedCount = 0;
  await createConcurrentOperations({
    cancellationToken,
    concurrencyLimit,
    array: executionSteps,
    start: async executionOptionsFromStep => {
      const executionIndex = executionSteps.indexOf(executionOptionsFromStep);
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
        collectRuntimeName,
        collectRuntimeVersion,
        collectCoverage,
        collectNamespace,
        mainFileNotFoundCallback,
        beforeExecutionCallback,
        afterExecutionCallback,
        gracefulStopAllocatedMs
      } = executionOptions;
      const beforeExecutionInfo = {
        allocatedMs,
        name,
        executionId,
        fileRelativeUrl,
        executionIndex
      };
      const filePath = urlToFileSystemPath(`${projectDirectoryUrl}${fileRelativeUrl}`);
      const fileExists = await pathLeadsToFile(filePath);

      if (!fileExists) {
        mainFileNotFoundCallback(beforeExecutionInfo);
        return;
      }

      beforeExecutionCallback(beforeExecutionInfo);
      const executionResult = await launchAndExecute({
        cancellationToken: executionCancellationToken,
        launchLogger,
        executeLogger,
        launch: params => launch({
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          compileServerOrigin,
          ...params
        }),
        allocatedMs,
        measureDuration,
        collectRuntimeName,
        collectRuntimeVersion,
        mirrorConsole,
        captureConsole,
        gracefulStopAllocatedMs,
        stopAfterExecute,
        stopAfterExecuteReason: "execution-done",
        executionId,
        fileRelativeUrl,
        collectCoverage,
        collectNamespace,
        ...rest
      });
      const afterExecutionInfo = { ...beforeExecutionInfo,
        ...executionResult
      };
      afterExecutionCallback(afterExecutionInfo);

      if (executionResult.status === "timedout") {
        timedoutCount++;
      } else if (executionResult.status === "disconnected") {
        disconnectedCount++;
      } else if (executionResult.status === "errored") {
        erroredCount++;
      } else if (executionResult.status === "completed") {
        completedCount++;
      }

      if (loggerToLevels(logger).info) {
        let log = createExecutionResultLog(afterExecutionInfo, {
          completedExecutionLogAbbreviation,
          executionCount,
          disconnectedCount,
          timedoutCount,
          erroredCount,
          completedCount
        });
        const {
          columns = 80
        } = process.stdout;
        log = wrapAnsi(log, columns, {
          trim: false,
          hard: true,
          wordWrap: false
        });

        if (previousExecutionLog && completedExecutionLogMerging && previousExecutionResult && previousExecutionResult.status === "completed" && executionResult.status === "completed") {
          previousExecutionLog = previousExecutionLog.update(log);
        } else {
          previousExecutionLog = writeLog(log);
        }
      }

      if (fileRelativeUrl in report === false) {
        report[fileRelativeUrl] = {};
      }

      report[fileRelativeUrl][name] = executionResult;
      previousExecutionResult = executionResult;
    }
  }); // tell everyone we are done
  // (used to stop potential chrome browser still opened to be reused)

  allExecutionDoneCancellationSource.cancel("all execution done");
  const summary = reportToSummary(report);
  summary.startMs = startMs;
  summary.endMs = Date.now();

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
        const fileExecutionResultForRuntime = fileExecutionResult[executionName];
        return predicate(fileExecutionResultForRuntime);
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
  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap,
  convertMap,
  compileGroupCount,
  plan,
  concurrencyLimit,
  executionDefaultOptions,
  stopAfterExecute,
  completedExecutionLogMerging,
  completedExecutionLogAbbreviation,
  logSummary,
  // coverage parameters
  coverage,
  coverageConfig,
  coverageIncludeMissing,
  ...rest
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
    outDirectoryRelativeUrl,
    stop
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
    compileServerProtocol,
    compileServerPrivateKey,
    compileServerCertificate,
    compileServerIp,
    compileServerPort,
    keepProcessAlive: true,
    // to be sure it stays alive
    babelPluginMap,
    convertMap,
    compileGroupCount,
    coverageConfig
  })]);
  const executionResult = await executeConcurrently(executionSteps, {
    cancellationToken,
    logger,
    launchLogger,
    executeLogger,
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    compileServerOrigin,
    importMapFileUrl,
    importDefaultExtension,
    babelPluginMap,
    stopAfterExecute,
    concurrencyLimit,
    executionDefaultOptions,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    logSummary,
    coverage,
    coverageConfig,
    coverageIncludeMissing,
    ...rest
  });
  stop("all execution done");
  return executionResult;
};

const executionIsPassed = ({
  summary
}) => summary.executionCount === summary.completedCount;

const generateCoverageJsonFile = async (coverageMap, coverageJsonFileUrl) => {
  await writeFile(coverageJsonFileUrl, JSON.stringify(coverageMap, null, "  "));
};

const {
  readFileSync
} = require$1("fs");

const libReport = require$1("istanbul-lib-report");

const reports = require$1("istanbul-reports");

const {
  createCoverageMap
} = require$1("istanbul-lib-coverage");

const generateCoverageHtmlDirectory = async (coverageMap, htmlDirectoryRelativeUrl, projectDirectoryUrl) => {
  const context = libReport.createContext({
    dir: urlToFileSystemPath(projectDirectoryUrl),
    coverageMap: createCoverageMap(coverageMap),
    sourceFinder: path => {
      return readFileSync(urlToFileSystemPath(resolveUrl$1(path, projectDirectoryUrl)), "utf8");
    }
  });
  const report = reports.create("html", {
    skipEmpty: true,
    skipFull: true,
    subdir: htmlDirectoryRelativeUrl
  });
  report.execute(context);
};

const libReport$1 = require$1("istanbul-lib-report");

const reports$1 = require$1("istanbul-reports");

const {
  createCoverageMap: createCoverageMap$1
} = require$1("istanbul-lib-coverage");

const generateCoverageTextLog = coverageMap => {
  const context = libReport$1.createContext({
    coverageMap: createCoverageMap$1(coverageMap)
  });
  const report = reports$1.create("text", {
    skipEmpty: true,
    skipFull: true
  });
  report.execute(context);
};

const jsenvCoverageConfig = {
  "./index.js": true,
  "./src/**/*.js": true,
  "./**/*.test.*": false,
  // contains .test. -> nope
  "./**/test/": false // inside a test folder -> nope,

};

const executeTestPlan = async ({
  cancellationToken = createCancellationTokenForProcess(),
  logLevel = "info",
  compileServerLogLevel = "warn",
  launchLogLevel = "warn",
  executeLogLevel = "off",
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap,
  convertMap,
  compileGroupCount = 2,
  testPlan,
  concurrencyLimit,
  executionDefaultOptions = {},
  // stopAfterExecute: true to ensure runtime is stopped once executed
  // because we have what we wants: execution is completed and
  // we have associated coverageMap and capturedConsole
  // you can still pass false to debug what happens
  // meaning all node process and browsers launched stays opened
  stopAfterExecute = true,
  completedExecutionLogAbbreviation = false,
  completedExecutionLogMerging = false,
  logSummary = true,
  updateProcessExitCode = true,
  coverage = process.argv.includes("--cover") || process.argv.includes("--coverage"),
  coverageConfig = jsenvCoverageConfig,
  coverageIncludeMissing = true,
  coverageAndExecutionAllowed = false,
  coverageTextLog = true,
  coverageJsonFile = Boolean(process.env.CI),
  coverageJsonFileLog = true,
  coverageJsonFileRelativeUrl = "./coverage/coverage-final.json",
  coverageHtmlDirectory = !process.env.CI,
  coverageHtmlDirectoryRelativeUrl = "./coverage/",
  coverageHtmlDirectoryIndexLog = true,
  // for chromiumExecutablePath, firefoxExecutablePath and webkitExecutablePath
  // but we need something angostic that just forward the params hence using ...rest
  ...rest
}) => {
  return catchCancellation(async () => {
    const logger = createLogger({
      logLevel
    });
    const launchLogger = createLogger({
      logLevel: launchLogLevel
    });
    const executeLogger = createLogger({
      logLevel: executeLogLevel
    });
    cancellationToken.register(cancelError => {
      if (cancelError.reason === "process SIGINT") {
        logger.info(`process SIGINT -> cancelling test execution`);
      }
    });
    projectDirectoryUrl = assertProjectDirectoryUrl({
      projectDirectoryUrl
    });
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
      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      babelPluginMap,
      convertMap,
      compileGroupCount,
      plan: testPlan,
      concurrencyLimit,
      executionDefaultOptions,
      stopAfterExecute,
      completedExecutionLogMerging,
      completedExecutionLogAbbreviation,
      logSummary,
      coverage,
      coverageConfig,
      coverageIncludeMissing,
      ...rest
    });

    if (updateProcessExitCode && !executionIsPassed(result)) {
      process.exitCode = 1;
    }

    const promises = []; // keep this one first because it does ensureEmptyDirectory
    // and in case coverage json file gets written in the same directory
    // it must be done before

    if (coverage && coverageHtmlDirectory) {
      const coverageHtmlDirectoryUrl = resolveDirectoryUrl(coverageHtmlDirectoryRelativeUrl, projectDirectoryUrl);
      await ensureEmptyDirectory(coverageHtmlDirectoryUrl);

      if (coverageHtmlDirectoryIndexLog) {
        const htmlCoverageDirectoryIndexFileUrl = `${coverageHtmlDirectoryUrl}index.html`;
        logger.info(`-> ${urlToFileSystemPath(htmlCoverageDirectoryIndexFileUrl)}`);
      }

      promises.push(generateCoverageHtmlDirectory(result.coverageMap, coverageHtmlDirectoryRelativeUrl, projectDirectoryUrl));
    }

    if (coverage && coverageJsonFile) {
      const coverageJsonFileUrl = resolveUrl$1(coverageJsonFileRelativeUrl, projectDirectoryUrl);

      if (coverageJsonFileLog) {
        logger.info(`-> ${urlToFileSystemPath(coverageJsonFileUrl)}`);
      }

      promises.push(generateCoverageJsonFile(result.coverageMap, coverageJsonFileUrl));
    }

    if (coverage && coverageTextLog) {
      promises.push(generateCoverageTextLog(result.coverageMap));
    }

    await Promise.all(promises);
    return result;
  }).catch(e => {
    process.exitCode = 1;
    throw e;
  });
};

/* eslint-disable import/max-dependencies */
const generateBundle = async ({
  cancellationToken = createCancellationTokenForProcess(),
  logLevel = "info",
  compileServerLogLevel = "warn",
  logger,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  env = {},
  browser = false,
  node = false,
  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap = jsenvBabelPluginMap,
  compileGroupCount = 1,
  runtimeScoreMap = { ...jsenvBrowserScoreMap,
    node: jsenvNodeVersionScoreMap
  },
  balancerTemplateFileUrl,
  entryPointMap = {
    main: "./index.js"
  },
  bundleDirectoryRelativeUrl,
  bundleDirectoryClean = false,
  format,
  formatInputOptions = {},
  formatOutputOptions = {},
  minify = false,
  minifyJsOptions = {},
  minifyCssOptions = {},
  minifyHtmlOptions = {},
  sourcemapExcludeSources = true,
  writeOnFileSystem = true,
  manifestFile = false,
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
  return catchCancellation(async () => {
    logger = logger || createLogger({
      logLevel
    });
    projectDirectoryUrl = assertProjectDirectoryUrl({
      projectDirectoryUrl
    });
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
      await ensureEmptyDirectory(bundleDirectoryUrl);
    }

    const extension = formatOutputOptions && formatOutputOptions.entryFileNames ? path.extname(formatOutputOptions.entryFileNames) : ".js";
    const chunkId = `${Object.keys(entryPointMap)[0]}${extension}`;
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

      await assertFilePresence(balancerTemplateFileUrl);
    }

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
      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      env,
      babelPluginMap,
      compileGroupCount,
      runtimeScoreMap,
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
        minifyJsOptions,
        minifyCssOptions,
        minifyHtmlOptions,
        format,
        formatInputOptions,
        formatOutputOptions,
        writeOnFileSystem,
        sourcemapExcludeSources,
        manifestFile
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
      formatInputOptions,
      formatOutputOptions,
      minify,
      writeOnFileSystem,
      sourcemapExcludeSources,
      manifestFile
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
      formatInputOptions,
      formatOutputOptions,
      minify,
      writeOnFileSystem,
      sourcemapExcludeSources,
      manifestFile
    })]);
  }).catch(e => {
    process.exitCode = 1;
    throw e;
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
    [entryPointName]: `./${urlToRelativeUrl(balancerTemplateFileUrl, projectDirectoryUrl)}`
  },
  sourcemapExcludeSources: true,
  ...rest,
  format: "global"
})));

const generateCommonJsBundle = async ({
  bundleDirectoryRelativeUrl = "./dist/commonjs",
  cjsExtension = true,
  node = true,
  ...rest
}) => generateBundle({
  format: "commonjs",
  bundleDirectoryRelativeUrl,
  node,
  formatOutputOptions: { ...(cjsExtension ? {
      // by default it's [name].js
      entryFileNames: `[name].cjs`,
      chunkFileNames: `[name]-[hash].cjs`
    } : {})
  },
  balancerTemplateFileUrl: resolveUrl$1("./src/internal/bundling/commonjs-balancer-template.js", jsenvCoreDirectoryUrl),
  ...rest
});

const generateCommonJsBundleForNode = ({
  babelPluginMap = jsenvBabelPluginMap,
  bundleDirectoryRelativeUrl,
  nodeMinimumVersion = decideNodeMinimumVersion(),
  cjsExtension,
  ...rest
}) => {
  const babelPluginMapForNode = computeBabelPluginMapForRuntime({
    babelPluginMap,
    runtimeName: "node",
    runtimeVersion: nodeMinimumVersion
  });
  return generateCommonJsBundle({
    bundleDirectoryRelativeUrl,
    cjsExtension,
    compileGroupCount: 1,
    babelPluginMap: babelPluginMapForNode,
    ...rest
  });
};

const decideNodeMinimumVersion = () => {
  return process.version.slice(1);
};

const generateEsModuleBundle = ({
  bundleDirectoryRelativeUrl = "./dist/esmodule",
  ...rest
}) => generateBundle({
  format: "esm",
  bundleDirectoryRelativeUrl,
  ...rest
});

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

const jsenvExplorableConfig = {
  "./index.js": true,
  "./src/**/*.js": true,
  "./test/**/*.js": true
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

  const cleanup = memoize(async reason => {
    const localCallbackArray = callbackArray.slice();
    await Promise.all(localCallbackArray.map(callback => callback(reason)));
  });
  return {
    registerCleanupCallback,
    cleanup
  };
};

const trackPageToNotify = (page, {
  onError,
  onConsole
}) => {
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
    // https://github.com/microsoft/playwright/blob/master/docs/api.md#event-console
    callback: async consoleMessage => {
      onConsole({
        type: consoleMessage.type(),
        text: appendNewLine(extractTextFromConsoleMessage(consoleMessage))
      });
    }
  });
  return () => {
    removeErrorListener();
    removePageErrorListener();
    removeConsoleListener();
  };
};

const appendNewLine = string => `${string}
`;

const extractTextFromConsoleMessage = consoleMessage => {
  return consoleMessage.text(); // ensure we use a string so that istanbul won't try
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

const createSharing = ({
  argsToId = argsToIdFallback
} = {}) => {
  const tokenMap = {};

  const getSharingToken = (...args) => {
    const id = argsToId(args);

    if (id in tokenMap) {
      return tokenMap[id];
    }

    const sharingToken = createSharingToken({
      unusedCallback: () => {
        delete tokenMap[id];
      }
    });
    tokenMap[id] = sharingToken;
    return sharingToken;
  };

  const getUniqueSharingToken = () => {
    return createSharingToken();
  };

  return {
    getSharingToken,
    getUniqueSharingToken
  };
};

const createSharingToken = ({
  unusedCallback = () => {}
} = {}) => {
  let useCount = 0;
  let sharedValue;
  let cleanup;
  const sharingToken = {
    isUsed: () => useCount > 0,
    setSharedValue: (value, cleanupFunction = () => {}) => {
      sharedValue = value;
      cleanup = cleanupFunction;
    },
    useSharedValue: () => {
      useCount++;
      let stopped = false;
      let stopUsingReturnValue;

      const stopUsing = () => {
        // ensure if stopUsing is called many times
        // it returns the same value and does not decrement useCount more than once
        if (stopped) {
          return stopUsingReturnValue;
        }

        stopped = true;
        useCount--;

        if (useCount === 0) {
          unusedCallback();
          sharedValue = undefined;
          stopUsingReturnValue = cleanup();
        } else {
          stopUsingReturnValue = undefined;
        }

        return stopUsingReturnValue;
      };

      return [sharedValue, stopUsing];
    }
  };
  return sharingToken;
};

const argsToIdFallback = args => JSON.stringify(args);

const startBrowserServer = async ({
  cancellationToken,
  logLevel = "warn",
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin
}) => {
  const browserJsFileUrl = resolveUrl$1("./src/internal/browser-launcher/browser-js-file.js", jsenvCoreDirectoryUrl);
  const browserjsFileRelativeUrl = urlToRelativeUrl(browserJsFileUrl, projectDirectoryUrl);
  const browserBundledJsFileRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_GLOBAL_BUNDLE}/${browserjsFileRelativeUrl}`;
  const browserBundledJsFileRemoteUrl = `${compileServerOrigin}/${browserBundledJsFileRelativeUrl}`;
  return startServer({
    cancellationToken,
    logLevel,
    // should we reuse compileServer privateKey/certificate ?
    protocol: compileServerOrigin.startsWith("http:") ? "http" : "https",
    sendInternalErrorStack: true,
    requestToResponse: request => firstService(() => {
      if (request.ressource === "/.jsenv/browser-script.js") {
        return {
          status: 307,
          headers: {
            location: browserBundledJsFileRemoteUrl
          }
        };
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

const jsenvHtmlFileUrl = resolveUrl$1("./src/internal/jsenv-html-file.html", jsenvCoreDirectoryUrl);

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

const getBrowserExecutionDynamicData = ({
  projectDirectoryUrl,
  compileServerOrigin
}) => {
  const browserRuntimeFileRelativeUrl = projectDirectoryUrl === jsenvCoreDirectoryUrl ? "src/browserRuntime.js" : `${urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl)}src/browserRuntime.js`;
  const sourcemapMainFileUrl = fileSystemPathToUrl(require$1.resolve("source-map/dist/source-map.js"));
  const sourcemapMappingFileUrl = fileSystemPathToUrl(require$1.resolve("source-map/lib/mappings.wasm"));
  const sourcemapMainFileRelativeUrl = urlToRelativeUrl(sourcemapMainFileUrl, projectDirectoryUrl);
  const sourcemapMappingFileRelativeUrl = urlToRelativeUrl(sourcemapMappingFileUrl, projectDirectoryUrl);
  return {
    browserRuntimeFileRelativeUrl,
    sourcemapMainFileRelativeUrl,
    sourcemapMappingFileRelativeUrl,
    compileServerOrigin
  };
};

const evaluateImportExecution = async ({
  cancellationToken,
  projectDirectoryUrl,
  htmlFileRelativeUrl,
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
  const fileUrl = resolveUrl$1(fileRelativeUrl, projectDirectoryUrl);
  await assertFilePresence(fileUrl);

  if (typeof htmlFileRelativeUrl === "undefined") {
    htmlFileRelativeUrl = urlToRelativeUrl(jsenvHtmlFileUrl, projectDirectoryUrl);
  } else if (typeof htmlFileRelativeUrl !== "string") {
    throw new TypeError(`htmlFileRelativeUrl must be a string, received ${htmlFileRelativeUrl}`);
  }

  const htmlFileUrl = resolveUrl$1(htmlFileRelativeUrl, projectDirectoryUrl);
  await assertFilePresence(htmlFileUrl);
  const htmlFileClientUrl = `${executionServerOrigin}/${htmlFileRelativeUrl}`;
  await page.goto(htmlFileClientUrl); // https://github.com/GoogleChrome/puppeteer/blob/v1.14.0/docs/api.md#pageevaluatepagefunction-args
  // yes evaluate supports passing a function directly
  // but when I do that, istanbul will put coverage statement inside it
  // and I don't want that because function is evaluated client side

  const javaScriptExpressionSource = createBrowserIIFEString({
    outDirectoryRelativeUrl,
    fileRelativeUrl,
    ...getBrowserExecutionDynamicData({
      projectDirectoryUrl,
      compileServerOrigin
    }),
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

const createBrowserIIFEString = data => `(() => {
  return window.execute(${JSON.stringify(data, null, "    ")})
})()`;

/* eslint-disable import/max-dependencies */

const playwright = require$1("playwright-core");

const chromiumSharing = createSharing();
const launchChromium = async ({
  cancellationToken = createCancellationToken(),
  chromiumExecutablePath,
  browserServerLogLevel,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  headless = true,
  // about debug check https://github.com/microsoft/playwright/blob/master/docs/api.md#browsertypelaunchserveroptions
  debug = false,
  debugPort = 0,
  stopOnExit = true,
  share = false
}) => {
  const ressourceTracker = trackRessources$1();
  const sharingToken = share ? chromiumSharing.getSharingToken({
    chromiumExecutablePath,
    headless,
    debug,
    debugPort
  }) : chromiumSharing.getUniqueSharingToken();

  if (!sharingToken.isUsed()) {
    const launchOperation = launchBrowser("chromium", {
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        executablePath: chromiumExecutablePath,
        ...(debug ? {
          devtools: true
        } : {}),
        args: [// https://github.com/GoogleChrome/puppeteer/issues/1834
        // https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#tips
        // "--disable-dev-shm-usage",
        ...(debug ? [`--remote-debugging-port=${debugPort}`] : [])]
      },
      stopOnExit
    });
    sharingToken.setSharedValue(launchOperation);
  }

  const [launchOperation, stopUsingBrowser] = sharingToken.useSharedValue();
  ressourceTracker.registerCleanupCallback(stopUsingBrowser);
  const browser = await launchOperation;

  if (debug) {
    // https://github.com/puppeteer/puppeteer/blob/v2.0.0/docs/api.md#browserwsendpoint
    // https://chromedevtools.github.io/devtools-protocol/#how-do-i-access-the-browser-target
    const webSocketEndpoint = browser.wsEndpoint();
    const webSocketUrl = new URL(webSocketEndpoint);
    const browserEndpoint = `http://${webSocketUrl.host}/json/version`;
    const browserResponse = await fetchUrl$1(browserEndpoint, {
      cancellationToken,
      ignoreHttpsError: true
    });
    const {
      valid,
      message
    } = validateResponseStatusIsOk(browserResponse);

    if (!valid) {
      throw new Error(message);
    }

    const browserResponseObject = JSON.parse(browserResponse.body);
    const {
      webSocketDebuggerUrl
    } = browserResponseObject;
    console.log(`Debugger listening on ${webSocketDebuggerUrl}`);
  }

  return {
    browser,
    name: "chromium",
    version: "82.0.4057.0",
    stop: ressourceTracker.cleanup,
    ...browserToRuntimeHooks(browser, {
      cancellationToken,
      ressourceTracker,
      browserServerLogLevel,
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin
    })
  };
};
const launchChromiumTab = namedArgs => launchChromium({
  share: true,
  ...namedArgs
});
const firefoxSharing = createSharing();
const launchFirefox = async ({
  cancellationToken = createCancellationToken(),
  firefoxExecutablePath,
  browserServerLogLevel,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  headless = true,
  stopOnExit = true,
  share = false
}) => {
  const ressourceTracker = trackRessources$1();
  const sharingToken = share ? firefoxSharing.getSharingToken({
    firefoxExecutablePath,
    headless
  }) : firefoxSharing.getUniqueSharingToken();

  if (!sharingToken.isUsed()) {
    const launchOperation = launchBrowser("firefox", {
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        executablePath: firefoxExecutablePath
      },
      stopOnExit
    });
    sharingToken.setSharedValue(launchOperation);
  }

  const [launchOperation, stopUsingBrowser] = sharingToken.useSharedValue();
  ressourceTracker.registerCleanupCallback(stopUsingBrowser);
  const browser = await launchOperation;
  return {
    browser,
    name: "firefox",
    version: "73.0b13",
    stop: ressourceTracker.cleanup,
    ...browserToRuntimeHooks(browser, {
      cancellationToken,
      ressourceTracker,
      browserServerLogLevel,
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin
    })
  };
};
const launchFirefoxTab = namedArgs => launchFirefox({
  share: true,
  ...namedArgs
});
const webkitSharing = createSharing();
const launchWebkit = async ({
  cancellationToken = createCancellationToken(),
  webkitExecutablePath,
  browserServerLogLevel,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  headless = true,
  stopOnExit = true,
  share = false
}) => {
  const ressourceTracker = trackRessources$1();
  const sharingToken = share ? webkitSharing.getSharingToken({
    webkitExecutablePath,
    headless
  }) : webkitSharing.getUniqueSharingToken();

  if (!sharingToken.isUsed()) {
    const launchOperation = launchBrowser("webkit", {
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        executablePath: webkitExecutablePath
      },
      stopOnExit
    });
    sharingToken.setSharedValue(launchOperation);
  }

  const [launchOperation, stopUsingBrowser] = sharingToken.useSharedValue();
  ressourceTracker.registerCleanupCallback(stopUsingBrowser);
  const browser = await launchOperation;
  return {
    browser,
    name: "webkit",
    version: "13.0.4",
    stop: ressourceTracker.cleanup,
    ...browserToRuntimeHooks(browser, {
      cancellationToken,
      ressourceTracker,
      browserServerLogLevel,
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin
    })
  };
};
const launchWebkitTab = namedArgs => launchWebkit({
  share: true,
  ...namedArgs
});

const launchBrowser = async (browserName, {
  cancellationToken,
  ressourceTracker,
  options,
  stopOnExit
}) => {
  const browserClass = playwright[browserName];
  const launchOperation = createStoppableOperation({
    cancellationToken,
    start: () => browserClass.launch({ ...options,
      // let's handle them to close properly browser, remove listener
      // and so on, instead of relying on puppetter
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false
    }),
    stop: async browser => {
      await browser.close();

      if (browser.isConnected()) {
        await new Promise(resolve => {
          const disconnectedCallback = () => {
            browser.removeListener("disconnected", disconnectedCallback);
            resolve();
          };

          browser.on("disconnected", disconnectedCallback);
        });
      }
    }
  });
  ressourceTracker.registerCleanupCallback(launchOperation.stop);

  if (stopOnExit) {
    const unregisterProcessTeadown = teardownSignal.addCallback(reason => {
      launchOperation.stop(`process ${reason}`);
    });
    ressourceTracker.registerCleanupCallback(unregisterProcessTeadown);
  }

  return launchOperation;
};

const browserServerSharing = createSharing();

const browserToRuntimeHooks = (browser, {
  cancellationToken,
  ressourceTracker,
  browserServerLogLevel,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin
}) => {
  const disconnected = new Promise(resolve => {
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    browser.on("disconnected", resolve);
  });
  const errorCallbackArray = [];

  const registerErrorCallback = callback => {
    errorCallbackArray.push(callback);
  };

  const consoleCallbackArray = [];

  const registerConsoleCallback = callback => {
    consoleCallbackArray.push(callback);
  };

  const executeFile = async (fileRelativeUrl, {
    htmlFileRelativeUrl,
    collectNamespace,
    collectCoverage,
    executionId,
    errorStackRemapping = true,
    // because we use a self signed certificate
    ignoreHTTPSErrors = true
  }) => {
    const sharingToken = browserServerSharing.getSharingToken();

    if (!sharingToken.isUsed()) {
      const browserServerPromise = startBrowserServer({
        cancellationToken,
        logLevel: browserServerLogLevel,
        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        compileServerOrigin
      });
      sharingToken.setSharedValue(browserServerPromise, async () => {
        const server = await browserServerPromise;
        await server.stop();
      });
    }

    const [browserServerPromise, stopUsingServer] = sharingToken.useSharedValue();
    ressourceTracker.registerCleanupCallback(stopUsingServer);
    const executionServer = await browserServerPromise; // open a tab to execute to the file

    const browserContext = await browser.newContext({
      ignoreHTTPSErrors
    });
    const page = await browserContext.newPage();
    ressourceTracker.registerCleanupCallback(async () => {
      try {
        await browserContext.close();
      } catch (e) {
        if (e.message.match(/^Protocol error \(.*?\): Target closed/)) {
          return;
        }

        if (e.message.match(/^Protocol error \(.*?\): Browser has been closed/)) {
          return;
        }

        throw e;
      }
    }); // track tab error and console

    const stopTrackingToNotify = trackPageToNotify(page, {
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
      }
    });
    ressourceTracker.registerCleanupCallback(stopTrackingToNotify); // import the file

    return evaluateImportExecution({
      cancellationToken,
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      htmlFileRelativeUrl,
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
    disconnected,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile
  };
};

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
        }

        if (!descriptor) {
          // it's apparently possible to have getOwnPropertyNames returning
          // a property that later returns a null descriptor
          // for instance window.showModalDialog in webkit 13.0
          return;
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

const supportsDynamicImport = memoize(async () => {
  const fileUrl = resolveUrl$1("./src/internal/dynamicImportSource.js", jsenvCoreDirectoryUrl);
  const filePath = urlToFileSystemPath(fileUrl);
  const fileAsString = String(fs.readFileSync(filePath));

  try {
    return await evalSource$1(fileAsString, filePath);
  } catch (e) {
    return false;
  }
});

const evalSource$1 = (code, filePath) => {
  const script = new vm.Script(code, {
    filename: filePath
  });
  return script.runInThisContext();
};

const getCommandArgument = (argv, name) => {
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === name) {
      return {
        name,
        index: i,
        value: ""
      };
    }

    if (arg.startsWith(`${name}=`)) {
      return {
        name,
        index: i,
        value: arg.slice(`${name}=`.length)
      };
    }

    i++;
  }

  return null;
};
const removeCommandArgument = (argv, name) => {
  const argvCopy = argv.slice();
  const arg = getCommandArgument(argv, name);

  if (arg) {
    argvCopy.splice(arg.index, 1);
  }

  return argvCopy;
};

const AVAILABLE_DEBUG_MODE = ["none", "inherit", "inspect", "inspect-brk", "debug", "debug-brk"];
const createChildExecArgv = async ({
  cancellationToken = createCancellationToken(),
  // https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_automatically-attach-debugger-to-nodejs-subprocesses
  processExecArgv = process.execArgv,
  processDebugPort = process.debugPort,
  debugPort = 0,
  debugMode = "inherit",
  debugModeInheritBreak = true,
  traceWarnings = "inherit",
  unhandledRejection = "inherit",
  jsonModules = "inherit"
} = {}) => {
  if (typeof debugMode === "string" && AVAILABLE_DEBUG_MODE.indexOf(debugMode) === -1) {
    throw new TypeError(`unexpected debug mode.
--- debug mode ---
${debugMode}
--- allowed debug mode ---
${AVAILABLE_DEBUG_MODE}`);
  }

  let childExecArgv = processExecArgv.slice();
  const {
    debugModeArg,
    debugPortArg
  } = getCommandDebugArgs(processExecArgv);
  let childDebugMode;

  if (debugMode === "inherit") {
    if (debugModeArg) {
      childDebugMode = debugModeArg.name.slice(2);

      if (debugModeInheritBreak === false) {
        if (childDebugMode === "--debug-brk") childDebugMode = "--debug";
        if (childDebugMode === "--inspect-brk") childDebugMode = "--inspect";
      }
    } else {
      childDebugMode = "none";
    }
  } else {
    childDebugMode = debugMode;
  }

  if (childDebugMode === "none") {
    // remove debug mode or debug port arg
    if (debugModeArg) {
      childExecArgv = removeCommandArgument(childExecArgv, debugModeArg.name);
    }

    if (debugPortArg) {
      childExecArgv = removeCommandArgument(childExecArgv, debugPortArg.name);
    }
  } else {
    // this is required because vscode does not
    // support assigning a child spwaned without a specific port
    const childDebugPort = debugPort === 0 ? await findFreePort(processDebugPort + 1, {
      cancellationToken
    }) : debugPort; // remove process debugMode, it will be replaced with the child debugMode

    const childDebugModeArgName = `--${childDebugMode}`;

    if (debugPortArg) {
      // replace the debug port arg
      const childDebugPortArgFull = `--${childDebugMode}-port${portToArgValue(childDebugPort)}`;
      childExecArgv[debugPortArg.index] = childDebugPortArgFull; // replace debug mode or create it (would be strange to have to create it)

      if (debugModeArg) {
        childExecArgv[debugModeArg.index] = childDebugModeArgName;
      } else {
        childExecArgv.push(childDebugModeArgName);
      }
    } else {
      const childDebugArgFull = `${childDebugModeArgName}${portToArgValue(childDebugPort)}`; // replace debug mode for child

      if (debugModeArg) {
        childExecArgv[debugModeArg.index] = childDebugArgFull;
      } // add debug mode to child
      else {
          childExecArgv.push(childDebugArgFull);
        }
    }
  }

  if (traceWarnings !== "inherit") {
    const traceWarningsArg = getCommandArgument(childExecArgv, "--trace-warnings");

    if (traceWarnings && !traceWarningsArg) {
      childExecArgv.push("--trace-warnings");
    } else if (!traceWarnings && traceWarningsArg) {
      childExecArgv.splice(traceWarningsArg.index, 1);
    }
  } // https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode


  if (unhandledRejection !== "inherit") {
    const unhandledRejectionArg = getCommandArgument(childExecArgv, "--unhandled-rejections");

    if (unhandledRejection && !unhandledRejectionArg) {
      childExecArgv.push(`--unhandled-rejections=${unhandledRejection}`);
    } else if (unhandledRejection && unhandledRejectionArg) {
      childExecArgv[unhandledRejectionArg.index] = `--unhandled-rejections=${unhandledRejection}`;
    } else if (!unhandledRejection && unhandledRejectionArg) {
      childExecArgv.splice(unhandledRejectionArg.index, 1);
    }
  } // https://nodejs.org/api/cli.html#cli_experimental_json_modules


  if (jsonModules !== "inherit") {
    const jsonModulesArg = getCommandArgument(childExecArgv, "--experimental-json-modules");

    if (jsonModules && !jsonModulesArg) {
      childExecArgv.push(`--experimental-json-modules`);
    } else if (!jsonModules && jsonModulesArg) {
      childExecArgv.splice(jsonModulesArg.index, 1);
    }
  }

  return childExecArgv;
};

const portToArgValue = port => {
  if (typeof port !== "number") return "";
  if (port === 0) return "";
  return `=${port}`;
}; // https://nodejs.org/en/docs/guides/debugging-getting-started/


const getCommandDebugArgs = argv => {
  const inspectArg = getCommandArgument(argv, "--inspect");

  if (inspectArg) {
    return {
      debugModeArg: inspectArg,
      debugPortArg: getCommandArgument(argv, "--inspect-port")
    };
  }

  const inspectBreakArg = getCommandArgument(argv, "--inspect-brk");

  if (inspectBreakArg) {
    return {
      debugModeArg: inspectBreakArg,
      debugPortArg: getCommandArgument(argv, "--inspect-port")
    };
  }

  const debugArg = getCommandArgument(argv, "--debug");

  if (debugArg) {
    return {
      debugModeArg: debugArg,
      debugPortArg: getCommandArgument(argv, "--debug-port")
    };
  }

  const debugBreakArg = getCommandArgument(argv, "--debug-brk");

  if (debugBreakArg) {
    return {
      debugModeArg: debugBreakArg,
      debugPortArg: getCommandArgument(argv, "--debug-port")
    };
  }

  return {};
};

/* eslint-disable import/max-dependencies */

const killProcessTree = require$1("tree-kill");

const EVALUATION_STATUS_OK = "evaluation-ok"; // https://nodejs.org/api/process.html#process_signal_events

const SIGINT_SIGNAL_NUMBER = 2;
const SIGTERM_SIGNAL_NUMBER = 15;
const SIGINT_EXIT_CODE = 128 + SIGINT_SIGNAL_NUMBER;
const SIGTERM_EXIT_CODE = 128 + SIGTERM_SIGNAL_NUMBER; // http://man7.org/linux/man-pages/man7/signal.7.html
// https:// github.com/nodejs/node/blob/1d9511127c419ec116b3ddf5fc7a59e8f0f1c1e4/lib/internal/child_process.js#L472

const GRACEFUL_STOP_SIGNAL = "SIGTERM";
const STOP_SIGNAL = "SIGKILL"; // it would be more correct if GRACEFUL_STOP_FAILED_SIGNAL was SIGHUP instead of SIGKILL.
// but I'm not sure and it changes nothing so just use SIGKILL

const GRACEFUL_STOP_FAILED_SIGNAL = "SIGKILL";
const nodeJsFileUrl = resolveUrl$1("./src/internal/node-launcher/node-js-file.js", jsenvCoreDirectoryUrl);
const launchNode = async ({
  cancellationToken = createCancellationToken(),
  logger,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  debugPort,
  debugMode,
  debugModeInheritBreak,
  traceWarnings,
  unhandledRejection,
  jsonModules,
  env,
  remap = true,
  collectCoverage = false
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

  const dynamicImportSupported = await supportsDynamicImport();
  const nodeControllableFileUrl = resolveUrl$1(dynamicImportSupported ? "./src/internal/node-launcher/nodeControllableFile.js" : "./src/internal/node-launcher/nodeControllableFile.cjs", jsenvCoreDirectoryUrl);
  await assertFilePresence(nodeControllableFileUrl);
  const execArgv = await createChildExecArgv({
    cancellationToken,
    debugPort,
    debugMode,
    debugModeInheritBreak,
    traceWarnings,
    unhandledRejection,
    jsonModules
  });
  env.COVERAGE_ENABLED = collectCoverage;
  const childProcess = child_process.fork(urlToFileSystemPath(nodeControllableFileUrl), {
    execArgv,
    // silent: true
    stdio: "pipe",
    env
  });
  logger.info(`${process.argv[0]} ${execArgv.join(" ")} ${urlToFileSystemPath(nodeControllableFileUrl)}`);
  const childProcessReadyPromise = new Promise(resolve => {
    onceProcessMessage(childProcess, "ready", resolve);
  });
  const consoleCallbackArray = [];

  const registerConsoleCallback = callback => {
    consoleCallbackArray.push(callback);
  };

  installProcessOutputListener(childProcess, ({
    type,
    text
  }) => {
    consoleCallbackArray.forEach(callback => {
      callback({
        type,
        text
      });
    });
  }); // keep listening process outputs while child process is killed to catch
  // outputs until it's actually disconnected
  // registerCleanupCallback(removeProcessOutputListener)

  const errorCallbackArray = [];

  const registerErrorCallback = callback => {
    errorCallbackArray.push(callback);
  };

  installProcessErrorListener(childProcess, error => {
    if (!childProcess.connected && error.code === "ERR_IPC_DISCONNECTED") {
      return;
    }

    errorCallbackArray.forEach(callback => {
      callback(error);
    });
  }); // keep listening process errors while child process is killed to catch
  // errors until it's actually disconnected
  // registerCleanupCallback(removeProcessErrorListener)
  // https://nodejs.org/api/child_process.html#child_process_event_disconnect

  let resolveDisconnect;
  const disconnected = new Promise(resolve => {
    resolveDisconnect = resolve;
    onceProcessMessage(childProcess, "disconnect", () => {
      resolve();
    });
  }); // child might exit without disconnect apparently, exit is disconnect for us

  childProcess.once("exit", () => {
    disconnectChildProcess();
  });

  const disconnectChildProcess = () => {
    try {
      childProcess.disconnect();
    } catch (e) {
      if (e.code === "ERR_IPC_DISCONNECTED") {
        resolveDisconnect();
      } else {
        throw e;
      }
    }

    return disconnected;
  };

  const killChildProcess = async ({
    signal
  }) => {
    logger.debug(`send ${signal} to child process with pid ${childProcess.pid}`);
    await new Promise(resolve => {
      killProcessTree(childProcess.pid, signal, error => {
        if (error) {
          // on windows: process with pid cannot be found
          if (error.stack.includes(`The process "${childProcess.pid}" not found`)) {
            resolve();
            return;
          } // on windows: child process with a pid cannot be found


          if (error.stack.includes("Reason: There is no running instance of the task")) {
            resolve();
            return;
          } // windows too


          if (error.stack.includes("The operation attempted is not supported")) {
            resolve();
            return;
          }

          logger.error(`error while killing process tree with ${signal}
    --- error stack ---
    ${error.stack}
    --- process.pid ---
    ${childProcess.pid}`); // even if we could not kill the child
          // we will ask it to disconnect

          resolve();
          return;
        }

        resolve();
      });
    }); // in case the child process did not disconnect by itself at this point
    // something is keeping it alive and it cannot be propely killed
    // disconnect it manually.
    // something inside makeProcessControllable.cjs ensure process.exit()
    // when the child process is disconnected.

    return disconnectChildProcess();
  };

  const stop = ({
    gracefulFailed
  } = {}) => {
    return killChildProcess({
      signal: gracefulFailed ? GRACEFUL_STOP_FAILED_SIGNAL : STOP_SIGNAL
    });
  };

  const gracefulStop = () => {
    return killChildProcess({
      signal: GRACEFUL_STOP_SIGNAL
    });
  };

  const executeFile = async (fileRelativeUrl, {
    collectNamespace,
    collectCoverage,
    executionId
  }) => {
    const execute = async () => {
      return new Promise(async (resolve, reject) => {
        onceProcessMessage(childProcess, "evaluate-result", ({
          status,
          value
        }) => {
          logger.debug(`child process sent the following evaluation result.
--- status ---
${status}
--- value ---
${value}`);
          if (status === EVALUATION_STATUS_OK) resolve(value);else reject(value);
        });
        const executeParams = {
          jsenvCoreDirectoryUrl,
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          fileRelativeUrl,
          compileServerOrigin,
          collectNamespace,
          collectCoverage,
          executionId,
          remap
        };
        const source = await generateSourceToEvaluate({
          dynamicImportSupported,
          cancellationToken,
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          compileServerOrigin,
          executeParams
        });
        logger.debug(`ask child process to evaluate
--- source ---
${source}`);
        await childProcessReadyPromise;

        try {
          await sendToProcess(childProcess, "evaluate", source);
        } catch (e) {
          logger.error(`error while sending message to child
--- error stack ---
${e.stack}`);
          throw e;
        }
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
    gracefulStop,
    stop,
    disconnected,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile
  };
};

const evalException$1 = (exceptionSource, {
  compileServerOrigin,
  projectDirectoryUrl
}) => {
  const error = evalSource$2(exceptionSource);

  if (error && error instanceof Error) {
    const compileServerOriginRegexp = new RegExp(escapeRegexpSpecialCharacters(`${compileServerOrigin}/`), "g");
    error.stack = error.stack.replace(compileServerOriginRegexp, projectDirectoryUrl);
    error.message = error.message.replace(compileServerOriginRegexp, projectDirectoryUrl); // const projectDirectoryPath = urlToFileSystemPath(projectDirectoryUrl)
    // const projectDirectoryPathRegexp = new RegExp(
    //   `(?<!file:\/\/)${escapeRegexpSpecialCharacters(projectDirectoryPath)}`,
    //   "g",
    // )
    // error.stack = error.stack.replace(projectDirectoryPathRegexp, projectDirectoryUrl)
    // error.message = error.message.replace(projectDirectoryPathRegexp, projectDirectoryUrl)
  }

  return error;
};

const sendToProcess = async (childProcess, type, data) => {
  const source = uneval(data, {
    functionAllowed: true
  });
  return new Promise((resolve, reject) => {
    childProcess.send({
      type,
      data: source
    }, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const installProcessOutputListener = (childProcess, callback) => {
  // beware that we may receive ansi output here, should not be a problem but keep that in mind
  const stdoutDataCallback = chunk => {
    callback({
      type: "log",
      text: String(chunk)
    });
  };

  childProcess.stdout.on("data", stdoutDataCallback);

  const stdErrorDataCallback = chunk => {
    callback({
      type: "error",
      text: String(chunk)
    });
  };

  childProcess.stderr.on("data", stdErrorDataCallback);
  return () => {
    childProcess.stdout.removeListener("data", stdoutDataCallback);
    childProcess.stderr.removeListener("data", stdoutDataCallback);
  };
};

const installProcessErrorListener = (childProcess, callback) => {
  // https://nodejs.org/api/child_process.html#child_process_event_error
  const errorListener = error => {
    removeExitListener(); // if an error occured we ignore the child process exitCode

    callback(error);
    onceProcessMessage(childProcess, "error", errorListener);
  };

  const removeErrorListener = onceProcessMessage(childProcess, "error", errorListener); // process.exit(1) in child process or process.exitCode = 1 + process.exit()
  // means there was an error even if we don't know exactly what.

  const removeExitListener = onceProcessEvent(childProcess, "exit", code => {
    if (code !== null && code !== 0 && code !== SIGINT_EXIT_CODE && code !== SIGTERM_EXIT_CODE) {
      removeErrorListener();
      callback(createExitWithFailureCodeError(code));
    }
  });
  return () => {
    removeErrorListener();
    removeExitListener();
  };
};

const createExitWithFailureCodeError = code => {
  if (code === 12) {
    return new Error(`child exited with 12: forked child wanted to use a non available port for debug`);
  }

  return new Error(`child exited with ${code}`);
};

const onceProcessMessage = (childProcess, type, callback) => {
  return onceProcessEvent(childProcess, "message", message => {
    if (message.type === type) {
      // eslint-disable-next-line no-eval
      callback(message.data ? eval(`(${message.data})`) : "");
    }
  });
};

const onceProcessEvent = (childProcess, type, callback) => {
  childProcess.on(type, callback);
  return () => {
    childProcess.removeListener(type, callback);
  };
};

const generateSourceToEvaluate = async ({
  dynamicImportSupported,
  executeParams,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin
}) => {
  if (dynamicImportSupported) {
    return `import { execute } from ${JSON.stringify(nodeJsFileUrl)}

export default execute(${JSON.stringify(executeParams, null, "    ")})`;
  }

  const nodeJsFileRelativeUrl = urlToRelativeUrl(nodeJsFileUrl, projectDirectoryUrl);
  const nodeBundledJsFileRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_COMMONJS_BUNDLE}/${nodeJsFileRelativeUrl}`;
  const nodeBundledJsFileUrl = `${projectDirectoryUrl}${nodeBundledJsFileRelativeUrl}`;
  const nodeBundledJsFileRemoteUrl = `${compileServerOrigin}/${nodeBundledJsFileRelativeUrl}`; // The compiled nodeRuntime file will be somewhere else in the filesystem
  // than the original nodeRuntime file.
  // It is important for the compiled file to be able to require
  // node modules that original file could access
  // hence the requireCompiledFileAsOriginalFile

  return `(() => {
  const { readFileSync } = require("fs")
  const Module = require('module')
  const { dirname } = require("path")
  const { fetchUrl } = require("@jsenv/server")

  const run = async () => {
    await fetchUrl(${JSON.stringify(nodeBundledJsFileRemoteUrl)}, { ignoreHttpsError: true })

    const nodeFilePath = ${JSON.stringify(urlToFileSystemPath(nodeJsFileUrl))}
    const nodeBundledJsFilePath = ${JSON.stringify(urlToFileSystemPath(nodeBundledJsFileUrl))}
    const { execute } = requireCompiledFileAsOriginalFile(nodeBundledJsFilePath, nodeFilePath)

    return execute(${JSON.stringify(executeParams, null, "    ")})
  }

  const requireCompiledFileAsOriginalFile = (compiledFilePath, originalFilePath) => {
    const fileContent = String(readFileSync(compiledFilePath))
    const moduleObject = new Module(compiledFilePath)
    moduleObject.paths = Module._nodeModulePaths(dirname(originalFilePath))
    moduleObject._compile(fileContent, compiledFilePath)
    return moduleObject.exports
  }

  return {
    default: run()
  }
})()`;
};

const evalSource$2 = (code, href) => {
  const script = new vm.Script(code, {
    filename: href
  });
  return script.runInThisContext();
};

const serveExploringIndex = async ({
  projectDirectoryUrl,
  htmlFileRelativeUrl,
  explorableConfig
}) => {
  const specifierMetaMap = metaMapToSpecifierMetaMap({
    explorable: explorableConfig
  });
  const matchingFileResultArray = await collectFiles({
    directoryUrl: projectDirectoryUrl,
    specifierMetaMap,
    predicate: ({
      explorable
    }) => explorable
  });
  const explorableRelativeUrlArray = matchingFileResultArray.map(({
    relativeUrl
  }) => relativeUrl);
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
      if (!headers.referer) {
        return {
          status: 400,
          statusText: `referer missing in request headers`
        };
      }

      let url;

      try {
        url = new URL(headers.referer);
      } catch (e) {
        return {
          status: 400,
          statusText: `unexpected referer in request headers, must be an url and received ${headers.referer}`
        };
      }

      const file = url.searchParams.get("file");

      if (stringHasConcecutiveSlashes(file)) {
        return {
          status: 400,
          statusText: `unexpected file in query string parameters, it contains consecutive slashes ${file}`
        };
      }

      const browserSelfExecuteCompiledFileRemoteUrl = `${origin}/${browserSelfExecuteDirectoryRelativeUrl}${file}`;
      return {
        status: 307,
        headers: {
          location: browserSelfExecuteCompiledFileRemoteUrl,
          vary: "referer"
        }
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

const stringHasConcecutiveSlashes = string => {
  let previousCharIsSlash = 0;
  let i = 0;

  while (i < string.length) {
    const char = string[i];
    i++;

    if (char === "/") {
      if (previousCharIsSlash) {
        return true;
      }

      previousCharIsSlash = true;
    } else {
      previousCharIsSlash = false;
    }
  }

  return false;
};

/* eslint-disable import/max-dependencies */
const startExploring = async ({
  cancellationToken = createCancellationTokenForProcess(),
  logLevel,
  compileServerLogLevel = logLevel,
  htmlFileRelativeUrl,
  explorableConfig = jsenvExplorableConfig,
  livereloading = false,
  watchConfig = {
    "./**/*": true,
    "./**/.git/": false,
    "./**/node_modules/": false
  },
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  babelPluginMap,
  convertMap,
  compileGroupCount = 2,
  keepProcessAlive = true,
  cors = true,
  protocol = "https",
  privateKey,
  certificate,
  ip = "127.0.0.1",
  port = 0,
  compileServerPort = 0,
  // random available port
  forcePort = false
}) => {
  return catchCancellation(async () => {
    const logger = createLogger({
      logLevel
    });
    projectDirectoryUrl = assertProjectDirectoryUrl({
      projectDirectoryUrl
    });
    await assertProjectDirectoryExists({
      projectDirectoryUrl
    });

    if (typeof htmlFileRelativeUrl === "undefined") {
      htmlFileRelativeUrl = urlToRelativeUrl(jsenvHtmlFileUrl, projectDirectoryUrl);
    } else if (typeof htmlFileRelativeUrl !== "string") {
      throw new TypeError(`htmlFileRelativeUrl must be a string, received ${htmlFileRelativeUrl}`);
    }

    const htmlFileUrl = resolveUrl$1(htmlFileRelativeUrl, projectDirectoryUrl);
    await assertFilePresence(htmlFileUrl);
    const stopExploringCancellationSource = createCancellationSource();
    cancellationToken = composeCancellationToken(cancellationToken, stopExploringCancellationSource.token);

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
      compileServerProtocol: protocol,
      compileServerPrivateKey: privateKey,
      compileServerCertificate: certificate,
      compileServerIp: ip,
      compileServerPort,
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
      const unregisterDirectoryLifecyle = registerDirectoryLifecycle(projectDirectoryUrl, {
        watchDescription: { ...watchConfig,
          [compileServer.jsenvDirectoryRelativeUrl]: false
        },
        updated: ({
          relativeUrl
        }) => {
          if (projectFileSet.has(relativeUrl)) {
            projectFileUpdatedCallback(relativeUrl);
          }
        },
        removed: ({
          relativeUrl
        }) => {
          if (projectFileSet.has(relativeUrl)) {
            projectFileSet.delete(relativeUrl);
            projectFileRemovedCallback(relativeUrl);
          }
        },
        keepProcessAlive: false,
        recursive: true
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
            origin
          } = request;
          const {
            referer
          } = headers;

          if (referer === origin || urlIsInsideOf(referer, origin)) {
            const refererRelativeUrl = urlToRelativeUrl(referer, origin);
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
        if (relativeUrl === htmlFileRelativeUrl) {
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
    } = compileServer; // dynamic data exists only to retrieve the compile server origin
    // that can be dynamic
    // otherwise the cached bundles would still target the previous compile server origin

    const jsenvDirectoryUrl = resolveUrl$1(compileServerJsenvDirectoryRelativeUrl, projectDirectoryUrl);
    const browserDynamicDataFileUrl = resolveUrl$1("./browser-execute-dynamic-data.json", jsenvDirectoryUrl);
    await writeFile(browserDynamicDataFileUrl, JSON.stringify(getBrowserExecutionDynamicData({
      projectDirectoryUrl,
      compileServerOrigin
    }), null, "  "));

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
      if (request.ressource === "/") {
        return serveExploringIndex({
          projectDirectoryUrl,
          htmlFileRelativeUrl,
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

    const exploringServer = await startServer({
      cancellationToken,
      logLevel,
      serverName: "exploring server",
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
      exploringServer.stop(reason);
    }, () => {});
    exploringServer.stoppedPromise.then(reason => {
      stopExploringCancellationSource.cancel(reason);
    });
    return {
      exploringServer,
      compileServer
    };
  }).catch(e => {
    process.exitCode = 1;
    throw e;
  });
};

exports.convertCommonJsWithBabel = convertCommonJsWithBabel;
exports.convertCommonJsWithRollup = convertCommonJsWithRollup;
exports.execute = execute;
exports.executeTestPlan = executeTestPlan;
exports.generateCommonJsBundle = generateCommonJsBundle;
exports.generateCommonJsBundleForNode = generateCommonJsBundleForNode;
exports.generateEsModuleBundle = generateEsModuleBundle;
exports.generateGlobalBundle = generateGlobalBundle;
exports.generateSystemJsBundle = generateSystemJsBundle;
exports.jsenvBabelPluginCompatMap = jsenvBabelPluginCompatMap;
exports.jsenvBabelPluginMap = jsenvBabelPluginMap;
exports.jsenvBrowserScoreMap = jsenvBrowserScoreMap;
exports.jsenvCoverageConfig = jsenvCoverageConfig;
exports.jsenvExplorableConfig = jsenvExplorableConfig;
exports.jsenvNodeVersionScoreMap = jsenvNodeVersionScoreMap;
exports.jsenvPluginCompatMap = jsenvPluginCompatMap;
exports.launchChromium = launchChromium;
exports.launchChromiumTab = launchChromiumTab;
exports.launchFirefox = launchFirefox;
exports.launchFirefoxTab = launchFirefoxTab;
exports.launchNode = launchNode;
exports.launchWebkit = launchWebkit;
exports.launchWebkitTab = launchWebkitTab;
exports.startExploring = startExploring;
//# sourceMappingURL=main.cjs.map
