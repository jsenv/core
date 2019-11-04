var __namespace__ = function (exports) {
  'use strict';

  var chunkId = "main.js";
  var importMap = {};

  var nativeTypeOf = function nativeTypeOf(obj) {
    return typeof obj;
  };

  var customTypeOf = function customTypeOf(obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

  var assertImportMap = function assertImportMap(value) {
    if (value === null) {
      throw new TypeError("an importMap must be an object, got null");
    }

    var type = _typeof(value);

    if (type !== "object") {
      throw new TypeError("an importMap must be an object, received ".concat(value));
    }

    if (Array.isArray(value)) {
      throw new TypeError("an importMap must be an object, received array ".concat(value));
    }
  };

  var hasScheme = function hasScheme(string) {
    return /^[a-zA-Z]{2,}:/.test(string);
  };

  var hrefToScheme = function hrefToScheme(href) {
    var colonIndex = href.indexOf(":");
    if (colonIndex === -1) return "";
    return href.slice(0, colonIndex);
  };

  var hrefToPathname = function hrefToPathname(href) {
    return ressourceToPathname(hrefToRessource(href));
  };

  var hrefToRessource = function hrefToRessource(href) {
    var scheme = hrefToScheme(href);

    if (scheme === "file") {
      return href.slice("file://".length);
    }

    if (scheme === "https" || scheme === "http") {
      // remove origin
      var afterProtocol = href.slice(scheme.length + "://".length);
      var pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
      return afterProtocol.slice(pathnameSlashIndex);
    }

    return href.slice(scheme.length + 1);
  };

  var ressourceToPathname = function ressourceToPathname(ressource) {
    var searchSeparatorIndex = ressource.indexOf("?");
    return searchSeparatorIndex === -1 ? ressource : ressource.slice(0, searchSeparatorIndex);
  };

  var hrefToOrigin = function hrefToOrigin(href) {
    var scheme = hrefToScheme(href);

    if (scheme === "file") {
      return "file://";
    }

    if (scheme === "http" || scheme === "https") {
      var secondProtocolSlashIndex = scheme.length + "://".length;
      var pathnameSlashIndex = href.indexOf("/", secondProtocolSlashIndex);
      if (pathnameSlashIndex === -1) return href;
      return href.slice(0, pathnameSlashIndex);
    }

    return href.slice(0, scheme.length + 1);
  };

  var pathnameToDirname = function pathnameToDirname(pathname) {
    var slashLastIndex = pathname.lastIndexOf("/");
    if (slashLastIndex === -1) return "";
    return pathname.slice(0, slashLastIndex);
  }; // could be useful: https://url.spec.whatwg.org/#url-miscellaneous


  var resolveUrl = function resolveUrl(specifier, baseUrl) {
    if (baseUrl) {
      if (typeof baseUrl !== "string") {
        throw new TypeError(writeBaseUrlMustBeAString({
          baseUrl: baseUrl,
          specifier: specifier
        }));
      }

      if (!hasScheme(baseUrl)) {
        throw new Error(writeBaseUrlMustBeAbsolute({
          baseUrl: baseUrl,
          specifier: specifier
        }));
      }
    }

    if (hasScheme(specifier)) {
      return specifier;
    }

    if (!baseUrl) {
      throw new Error(writeBaseUrlRequired({
        baseUrl: baseUrl,
        specifier: specifier
      }));
    } // scheme relative


    if (specifier.slice(0, 2) === "//") {
      return "".concat(hrefToScheme(baseUrl), ":").concat(specifier);
    } // origin relative


    if (specifier[0] === "/") {
      return "".concat(hrefToOrigin(baseUrl)).concat(specifier);
    }

    var baseOrigin = hrefToOrigin(baseUrl);
    var basePathname = hrefToPathname(baseUrl);

    if (specifier === ".") {
      var baseDirname = pathnameToDirname(basePathname);
      return "".concat(baseOrigin).concat(baseDirname, "/");
    } // pathname relative inside


    if (specifier.slice(0, 2) === "./") {
      var _baseDirname = pathnameToDirname(basePathname);

      return "".concat(baseOrigin).concat(_baseDirname, "/").concat(specifier.slice(2));
    } // pathname relative outside


    if (specifier.slice(0, 3) === "../") {
      var unresolvedPathname = specifier;
      var importerFolders = basePathname.split("/");
      importerFolders.pop();

      while (unresolvedPathname.slice(0, 3) === "../") {
        unresolvedPathname = unresolvedPathname.slice(3); // when there is no folder left to resolved
        // we just ignore '../'

        if (importerFolders.length) {
          importerFolders.pop();
        }
      }

      var resolvedPathname = "".concat(importerFolders.join("/"), "/").concat(unresolvedPathname);
      return "".concat(baseOrigin).concat(resolvedPathname);
    } // bare


    if (basePathname === "") {
      return "".concat(baseOrigin, "/").concat(specifier);
    }

    if (basePathname[basePathname.length] === "/") {
      return "".concat(baseOrigin).concat(basePathname).concat(specifier);
    }

    return "".concat(baseOrigin).concat(pathnameToDirname(basePathname), "/").concat(specifier);
  };

  var writeBaseUrlMustBeAString = function writeBaseUrlMustBeAString(_ref) {
    var baseUrl = _ref.baseUrl,
        specifier = _ref.specifier;
    return "baseUrl must be a string.\n--- base url ---\n".concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var writeBaseUrlMustBeAbsolute = function writeBaseUrlMustBeAbsolute(_ref2) {
    var baseUrl = _ref2.baseUrl,
        specifier = _ref2.specifier;
    return "baseUrl must be absolute.\n--- base url ---\n".concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var writeBaseUrlRequired = function writeBaseUrlRequired(_ref3) {
    var baseUrl = _ref3.baseUrl,
        specifier = _ref3.specifier;
    return "baseUrl required to resolve relative specifier.\n--- base url ---\n".concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var tryUrlResolution = function tryUrlResolution(string, url) {
    var result = resolveUrl(string, url);
    return hasScheme(result) ? result : null;
  };

  var resolveSpecifier = function resolveSpecifier(specifier, importer) {
    if (specifier[0] === "/" || specifier.startsWith("./") || specifier.startsWith("../")) {
      return resolveUrl(specifier, importer);
    }

    if (hasScheme(specifier)) {
      return specifier;
    }

    return null;
  };

  var sortImports = function sortImports(imports) {
    var importsSorted = {};
    Object.keys(imports).sort(compareLengthOrLocaleCompare).forEach(function (name) {
      importsSorted[name] = imports[name];
    });
    return importsSorted;
  };

  var sortScopes = function sortScopes(scopes) {
    var scopesSorted = {};
    Object.keys(scopes).sort(compareLengthOrLocaleCompare).forEach(function (scopeName) {
      scopesSorted[scopeName] = sortImports(scopes[scopeName]);
    });
    return scopesSorted;
  };

  var compareLengthOrLocaleCompare = function compareLengthOrLocaleCompare(a, b) {
    return b.length - a.length || a.localeCompare(b);
  };

  var normalizeImportMap = function normalizeImportMap(importMap, baseUrl) {
    assertImportMap(importMap);

    if (typeof baseUrl !== "string") {
      throw new TypeError(formulateBaseUrlMustBeAString({
        baseUrl: baseUrl
      }));
    }

    var imports = importMap.imports,
        scopes = importMap.scopes;
    return {
      imports: imports ? normalizeImports(imports, baseUrl) : undefined,
      scopes: scopes ? normalizeScopes(scopes, baseUrl) : undefined
    };
  };

  var normalizeImports = function normalizeImports(imports, baseUrl) {
    var importsNormalized = {};
    Object.keys(imports).forEach(function (specifier) {
      var address = imports[specifier];

      if (typeof address !== "string") {
        console.warn(formulateAddressMustBeAString({
          address: address,
          specifier: specifier
        }));
        return;
      }

      var specifierResolved = resolveSpecifier(specifier, baseUrl) || specifier;
      var addressUrl = tryUrlResolution(address, baseUrl);

      if (addressUrl === null) {
        console.warn(formulateAdressResolutionFailed({
          address: address,
          baseUrl: baseUrl,
          specifier: specifier
        }));
        return;
      }

      if (specifier.endsWith("/") && !addressUrl.endsWith("/")) {
        console.warn(formulateAddressUrlRequiresTrailingSlash({
          addressUrl: addressUrl,
          address: address,
          specifier: specifier
        }));
        return;
      }

      importsNormalized[specifierResolved] = addressUrl;
    });
    return sortImports(importsNormalized);
  };

  var normalizeScopes = function normalizeScopes(scopes, baseUrl) {
    var scopesNormalized = {};
    Object.keys(scopes).forEach(function (scope) {
      var scopeValue = scopes[scope];
      var scopeUrl = tryUrlResolution(scope, baseUrl);

      if (scopeUrl === null) {
        console.warn(formulateScopeResolutionFailed({
          scope: scope,
          baseUrl: baseUrl
        }));
        return;
      }

      var scopeValueNormalized = normalizeImports(scopeValue, baseUrl);
      scopesNormalized[scopeUrl] = scopeValueNormalized;
    });
    return sortScopes(scopesNormalized);
  };

  var formulateBaseUrlMustBeAString = function formulateBaseUrlMustBeAString(_ref) {
    var baseUrl = _ref.baseUrl;
    return "baseUrl must be a string.\n--- base url ---\n".concat(baseUrl);
  };

  var formulateAddressMustBeAString = function formulateAddressMustBeAString(_ref2) {
    var specifier = _ref2.specifier,
        address = _ref2.address;
    return "Address must be a string.\n--- address ---\n".concat(address, "\n--- specifier ---\n").concat(specifier);
  };

  var formulateAdressResolutionFailed = function formulateAdressResolutionFailed(_ref3) {
    var address = _ref3.address,
        baseUrl = _ref3.baseUrl,
        specifier = _ref3.specifier;
    return "Address url resolution failed.\n--- address ---\n".concat(address, "\n--- base url ---\n").concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var formulateAddressUrlRequiresTrailingSlash = function formulateAddressUrlRequiresTrailingSlash(_ref4) {
    var addressURL = _ref4.addressURL,
        address = _ref4.address,
        specifier = _ref4.specifier;
    return "Address must end with /.\n--- address url ---\n".concat(addressURL, "\n--- address ---\n").concat(address, "\n--- specifier ---\n").concat(specifier);
  };

  var formulateScopeResolutionFailed = function formulateScopeResolutionFailed(_ref5) {
    var scope = _ref5.scope,
        baseUrl = _ref5.baseUrl;
    return "Scope url resolution failed.\n--- scope ---\n".concat(scope, "\n--- base url ---\n").concat(baseUrl);
  };

  var pathnameToExtension = function pathnameToExtension(pathname) {
    var slashLastIndex = pathname.lastIndexOf("/");

    if (slashLastIndex !== -1) {
      pathname = pathname.slice(slashLastIndex + 1);
    }

    var dotLastIndex = pathname.lastIndexOf(".");
    if (dotLastIndex === -1) return ""; // if (dotLastIndex === pathname.length - 1) return ""

    return pathname.slice(dotLastIndex);
  };

  var applyImportMap = function applyImportMap(_ref) {
    var importMap = _ref.importMap,
        specifier = _ref.specifier,
        importer = _ref.importer;
    assertImportMap(importMap);

    if (typeof specifier !== "string") {
      throw new TypeError(writeSpecifierMustBeAString({
        specifier: specifier,
        importer: importer
      }));
    }

    if (importer) {
      if (typeof importer !== "string") {
        throw new TypeError(writeImporterMustBeAString({
          importer: importer,
          specifier: specifier
        }));
      }

      if (!hasScheme(importer)) {
        throw new Error(writeImporterMustBeAbsolute({
          importer: importer,
          specifier: specifier
        }));
      }
    }

    var specifierUrl = resolveSpecifier(specifier, importer);
    var specifierNormalized = specifierUrl || specifier;
    var scopes = importMap.scopes;

    if (scopes && importer) {
      var scopeKeyMatching = Object.keys(scopes).find(function (scopeKey) {
        return scopeKey === importer || specifierIsPrefixOf(scopeKey, importer);
      });

      if (scopeKeyMatching) {
        var scopeValue = scopes[scopeKeyMatching];
        var remappingFromScopeImports = applyImports(specifierNormalized, scopeValue);

        if (remappingFromScopeImports !== null) {
          return remappingFromScopeImports;
        }
      }
    }

    var imports = importMap.imports;

    if (imports) {
      var remappingFromImports = applyImports(specifierNormalized, imports);

      if (remappingFromImports !== null) {
        return remappingFromImports;
      }
    }

    if (specifierUrl) {
      return specifierUrl;
    }

    throw new Error(writeBareSpecifierMustBeRemapped({
      specifier: specifier,
      importer: importer
    }));
  };

  var applyImports = function applyImports(specifier, imports) {
    var importKeyArray = Object.keys(imports);
    var i = 0;

    while (i < importKeyArray.length) {
      var importKey = importKeyArray[i];
      i++;

      if (importKey === specifier) {
        var importValue = imports[importKey];
        return importValue;
      }

      if (specifierIsPrefixOf(importKey, specifier)) {
        var _importValue = imports[importKey];
        var afterImportKey = specifier.slice(importKey.length);
        return tryUrlResolution(afterImportKey, _importValue);
      }
    }

    return null;
  };

  var specifierIsPrefixOf = function specifierIsPrefixOf(specifierHref, href) {
    return specifierHref[specifierHref.length - 1] === "/" && href.startsWith(specifierHref);
  };

  var writeSpecifierMustBeAString = function writeSpecifierMustBeAString(_ref2) {
    var specifier = _ref2.specifier,
        importer = _ref2.importer;
    return "specifier must be a string.\n--- specifier ---\n".concat(specifier, "\n--- importer ---\n").concat(importer);
  };

  var writeImporterMustBeAString = function writeImporterMustBeAString(_ref3) {
    var importer = _ref3.importer,
        specifier = _ref3.specifier;
    return "importer must be a string.\n--- importer ---\n".concat(importer, "\n--- specifier ---\n").concat(specifier);
  };

  var writeImporterMustBeAbsolute = function writeImporterMustBeAbsolute(_ref4) {
    var importer = _ref4.importer,
        specifier = _ref4.specifier;
    return "importer must be an absolute url.\n--- importer ---\n".concat(importer, "\n--- specifier ---\n").concat(specifier);
  };

  var writeBareSpecifierMustBeRemapped = function writeBareSpecifierMustBeRemapped(_ref5) {
    var specifier = _ref5.specifier,
        importer = _ref5.importer;
    return "Unmapped bare specifier.\n--- specifier ---\n".concat(specifier, "\n--- importer ---\n").concat(importer);
  }; // directly target the files because this code


  var resolveImport = function resolveImport(_ref) {
    var specifier = _ref.specifier,
        importer = _ref.importer,
        importMap = _ref.importMap,
        _ref$defaultExtension = _ref.defaultExtension,
        defaultExtension = _ref$defaultExtension === void 0 ? true : _ref$defaultExtension;
    return applyDefaultExtension({
      url: importMap ? applyImportMap({
        importMap: importMap,
        specifier: specifier,
        importer: importer
      }) : resolveUrl(specifier, importer),
      importer: importer,
      defaultExtension: defaultExtension
    });
  };

  var applyDefaultExtension = function applyDefaultExtension(_ref2) {
    var url = _ref2.url,
        importer = _ref2.importer,
        defaultExtension = _ref2.defaultExtension;

    if (hrefToPathname(url) === "/") {
      return url;
    }

    if (url.endsWith("/")) {
      return url;
    }

    if (typeof defaultExtension === "string") {
      var extension = pathnameToExtension(url);

      if (extension === "") {
        return "".concat(url).concat(defaultExtension);
      }

      return url;
    }

    if (defaultExtension === true) {
      var _extension = pathnameToExtension(url);

      if (_extension === "" && importer) {
        var importerPathname = hrefToPathname(importer);
        var importerExtension = pathnameToExtension(importerPathname);
        return "".concat(url).concat(importerExtension);
      }
    }

    return url;
  }; // eslint-disable-next-line import/no-unresolved


  var _document = document,
      currentScript = _document.currentScript;
  var url = currentScript && currentScript.src || new URL(chunkId, document.baseURI).href;

  var resolve = function resolve(specifier) {
    return resolveImport({
      specifier: specifier,
      importer: url,
      importMap: memoizedGetImportMap(),
      defaultExtension: false
    });
  }; // better for perf and helps rollup to tree shake this out
  // when import.meta.resolve is not used


  var memoizedImportMap;

  var memoizedGetImportMap = function memoizedGetImportMap() {
    if (memoizedImportMap) return memoizedImportMap;
    memoizedImportMap = normalizeImportMap(importMap, url);
    return memoizedImportMap;
  };

  var basic = resolve("./file.js");
  var remapped = resolve("foo");
  exports.basic = basic;
  exports.remapped = remapped;
  return exports;
}({});
//# sourceMappingURL=./main.js.map