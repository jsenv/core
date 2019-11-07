'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var https = require('https');
var module$1 = require('module');

var startsWithWindowsDriveLetter = function startsWithWindowsDriveLetter(string) {
  var firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  var secondChar = string[1];
  if (secondChar !== ":") return false;
  return true;
};

var replaceSlashesWithBackSlashes = function replaceSlashesWithBackSlashes(string) {
  return string.replace(/\//g, "\\");
};

var pathnameToOperatingSystemPath = function pathnameToOperatingSystemPath(pathname) {
  if (pathname[0] !== "/") throw new Error("pathname must start with /, got ".concat(pathname));
  var pathnameWithoutLeadingSlash = pathname.slice(1);

  if (startsWithWindowsDriveLetter(pathnameWithoutLeadingSlash) && pathnameWithoutLeadingSlash[2] === "/") {
    return replaceSlashesWithBackSlashes(pathnameWithoutLeadingSlash);
  } // linux mac pathname === operatingSystemFilename


  return pathname;
};

var isWindowsPath = function isWindowsPath(path) {
  return startsWithWindowsDriveLetter(path) && path[2] === "\\";
};

var replaceBackSlashesWithSlashes = function replaceBackSlashesWithSlashes(string) {
  return string.replace(/\\/g, "/");
};

var operatingSystemPathToPathname = function operatingSystemPathToPathname(operatingSystemPath) {
  if (isWindowsPath(operatingSystemPath)) {
    return "/".concat(replaceBackSlashesWithSlashes(operatingSystemPath));
  } // linux and mac operatingSystemFilename === pathname


  return operatingSystemPath;
};

var pathnameIsInside = function pathnameIsInside(pathname, otherPathname) {
  return pathname.startsWith("".concat(otherPathname, "/"));
};

var pathnameToRelativePathname = function pathnameToRelativePathname(pathname, otherPathname) {
  return pathname.slice(otherPathname.length);
};

var hrefToScheme = function hrefToScheme(href) {
  var colonIndex = href.indexOf(":");
  if (colonIndex === -1) return "";
  return href.slice(0, colonIndex);
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

var pathnameToDirname = function pathnameToDirname(pathname) {
  var slashLastIndex = pathname.lastIndexOf("/");
  if (slashLastIndex === -1) return "";
  return pathname.slice(0, slashLastIndex);
};

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

// could be useful: https://url.spec.whatwg.org/#url-miscellaneous
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
  var basePathname = hrefToPathname(baseUrl); // pathname relative inside

  if (specifier.slice(0, 2) === "./") {
    var baseDirname = pathnameToDirname(basePathname);
    return "".concat(baseOrigin).concat(baseDirname, "/").concat(specifier.slice(2));
  } // pathname relative outside


  if (specifier.slice(0, 3) === "../") {
    var unresolvedPathname = specifier;
    var importerFolders = basePathname.split("/");
    importerFolders.pop();

    while (unresolvedPathname.slice(0, 3) === "../") {
      // when there is no folder left to resolved
      // we just ignore '../'
      if (importerFolders.length) {
        importerFolders.pop();
      }

      unresolvedPathname = unresolvedPathname.slice(3);
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

var _defineProperty = (function (obj, key, value) {
  // Shortcircuit the slow defineProperty path when possible.
  // We are trying to avoid issues where setters defined on the
  // prototype cause side effects under the fast path of simple
  // assignment. By checking for existence of the property with
  // the in operator, we can optimize most of this overhead away.
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
});

function _objectSpread (target) {
  for (var i = 1; i < arguments.length; i++) {
    // eslint-disable-next-line prefer-rest-params
    var source = arguments[i] === null ? {} : arguments[i];

    if (i % 2) {
      // eslint-disable-next-line no-loop-func
      ownKeys(source, true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      // eslint-disable-next-line no-loop-func
      ownKeys(source).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
} // This function is different to "Reflect.ownKeys". The enumerableOnly
// filters on symbol properties only. Returned string properties are always
// enumerable. It is good to use in objectSpread.

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    }); // eslint-disable-next-line prefer-spread

    keys.push.apply(keys, symbols);
  }

  return keys;
}

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

var objectWithoutPropertiesLoose = (function (source, excluded) {
  if (source === null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key;
  var i;

  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }

  return target;
});

var _objectWithoutProperties = (function (source, excluded) {
  if (source === null) return {};
  var target = objectWithoutPropertiesLoose(source, excluded);
  var key;
  var i;

  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }

  return target;
});

var importMap = {
  "imports": {
    "@babel/plugin-syntax-dynamic-import": "./node_modules/@babel/plugin-syntax-dynamic-import/lib/index.js",
    "@babel/plugin-transform-react-jsx": "./node_modules/@babel/plugin-transform-react-jsx/lib/index.js",
    "@babel/plugin-syntax-import-meta": "./node_modules/@babel/plugin-syntax-import-meta/lib/index.js",
    "@jsenv/node-module-import-map": "./node_modules/@jsenv/node-module-import-map/index.js",
    "@jsenv/prettier-check-project": "./node_modules/@jsenv/prettier-check-project/index.js",
    "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
    "@dmail/filesystem-matching": "./node_modules/@dmail/filesystem-matching/index.js",
    "@jsenv/commonjs-converter": "./node_modules/@jsenv/commonjs-converter/index.js",
    "@jsenv/chromium-launcher": "./node_modules/@jsenv/chromium-launcher/index.js",
    "@dmail/filesystem-watch": "./node_modules/@dmail/filesystem-watch/index.js",
    "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
    "istanbul-lib-instrument": "./node_modules/istanbul-lib-instrument/dist/index.js",
    "@jsenv/compile-server/": "./node_modules/@jsenv/compile-server/",
    "@jsenv/prettier-config": "./node_modules/@jsenv/prettier-config/index.js",
    "@jsenv/codecov-upload": "./node_modules/@jsenv/codecov-upload/index.js",
    "@jsenv/compile-server": "./node_modules/@jsenv/compile-server/index.js",
    "istanbul-lib-coverage": "./node_modules/istanbul-lib-coverage/index.js",
    "@jsenv/eslint-config": "./node_modules/@jsenv/eslint-config/index.js",
    "@jsenv/node-launcher": "./node_modules/@jsenv/node-launcher/index.js",
    "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
    "istanbul-lib-report": "./node_modules/istanbul-lib-report/index.js",
    "@jsenv/execution": "./node_modules/@jsenv/execution/index.js",
    "istanbul-reports": "./node_modules/istanbul-reports/index.js",
    "@jsenv/bundling": "./node_modules/@jsenv/bundling/index.js",
    "@jsenv/url-meta": "./node_modules/@jsenv/url-meta/index.js",
    "@jsenv/testing": "./node_modules/@jsenv/testing/index.js",
    "@dmail/assert": "./node_modules/@dmail/assert/index.js",
    "@dmail/helper": "./node_modules/@dmail/helper/index.js",
    "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
    "node-notifier": "./node_modules/node-notifier/index.js",
    "@jsenv/href/": "./node_modules/@jsenv/href/",
    "babel-eslint": "./node_modules/babel-eslint/lib/index.js",
    "@babel/core": "./node_modules/@babel/core/lib/index.js",
    "@jsenv/href": "./node_modules/@jsenv/href/index.js",
    "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
    "prettier": "./node_modules/prettier/index.js",
    "eslint": "./node_modules/eslint/lib/api.js",
    "rimraf": "./node_modules/rimraf/rimraf.js",
    "react": "./node_modules/react/index.js",
    "cuid": "./node_modules/cuid/index.js"
  },
  "scopes": {
    "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/import-map/node_modules/@jsenv/operating-system-path/": {
      "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/error-stack-sourcemap/node_modules/@jsenv/operating-system-path/": {
      "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/error-stack-sourcemap/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/import-map": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/index.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/import-map": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/index.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href": "./node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/operating-system-path/": {
      "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/operating-system-path/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/url-meta/node_modules/@jsenv/import-map/": {
      "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/url-meta/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/import-map/node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/logger/": {
      "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/logger/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/operating-system-path/": {
      "@jsenv/href": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/prettier-check-project/node_modules/@jsenv/operating-system-path/": {
      "@jsenv/href": "./node_modules/@jsenv/prettier-check-project/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/commonjs-converter/node_modules/babel-plugin-transform-commonjs/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@dmail/filesystem-matching/node_modules/@jsenv/operating-system-path/": {
      "@jsenv/href": "./node_modules/@dmail/filesystem-matching/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/commonjs-converter/node_modules/@jsenv/operating-system-path/": {
      "@jsenv/href": "./node_modules/@jsenv/commonjs-converter/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@dmail/filesystem-watch/node_modules/@jsenv/operating-system-path/": {
      "@jsenv/href": "./node_modules/@dmail/filesystem-watch/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/error-stack-sourcemap/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/error-stack-sourcemap/node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/error-stack-sourcemap/node_modules/@jsenv/href/index.js",
      "source-map": "./node_modules/@jsenv/node-launcher/node_modules/source-map/source-map.js",
      "/": "/"
    },
    "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href": "./node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/import-map": "./node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/index.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/prettier-check-project/node_modules/@jsenv/url-meta/": {
      "@jsenv/import-map": "./node_modules/@jsenv/import-map/index.js",
      "/": "/"
    },
    "./node_modules/@babel/helper-builder-binary-assignment-operator-visitor/": {
      "@babel/helper-explode-assignable-expression": "./node_modules/@babel/helper-explode-assignable-expression/lib/index.js",
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/logger/": {
      "@jsenv/href": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/logger/": {
      "@jsenv/href": "./node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/logger/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@dmail/filesystem-matching/node_modules/@jsenv/url-meta/": {
      "@jsenv/import-map": "./node_modules/@jsenv/import-map/index.js",
      "/": "/"
    },
    "./node_modules/@dmail/server/node_modules/@jsenv/operating-system-path/": {
      "@jsenv/href": "./node_modules/@dmail/server/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/chromium-launcher/node_modules/@jsenv/import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js"
    },
    "./node_modules/@dmail/filesystem-watch/node_modules/@jsenv/url-meta/": {
      "@jsenv/import-map": "./node_modules/@jsenv/import-map/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/compile-server/node_modules/@jsenv/import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js"
    },
    "./node_modules/rollup-plugin-node-globals/node_modules/magic-string/": {
      "vlq": "./node_modules/vlq/src/vlq.js"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js"
    },
    "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/": {
      "@jsenv/node-module-import-map": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/index.js",
      "@babel/helper-module-imports": "./node_modules/@babel/helper-module-imports/lib/index.js",
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/import-map/": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/import-map/",
      "@jsenv/import-map": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/import-map/index.js",
      "abort-controller": "./node_modules/abort-controller/dist/abort-controller.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "@dmail/server": "./node_modules/@dmail/server/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
      "@jsenv/core/": "./node_modules/@jsenv/core/",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/core": "./node_modules/@jsenv/core/index.js",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js",
      "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
      "rollup": "./node_modules/@jsenv/compile-server/node_modules/rollup/dist/rollup.es.js",
      "terser": "./node_modules/terser/dist/bundle.min.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@babel/template/": {
      "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
      "@babel/parser": "./node_modules/@jsenv/node-launcher/node_modules/@babel/parser/lib/index.js",
      "@babel/types": "./node_modules/@jsenv/node-launcher/node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/": {
      "@jsenv/node-module-import-map": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/index.js",
      "@babel/helper-module-imports": "./node_modules/@babel/helper-module-imports/lib/index.js",
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/import-map/": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/import-map/",
      "@jsenv/import-map": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/import-map/index.js",
      "abort-controller": "./node_modules/abort-controller/dist/abort-controller.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "@dmail/server": "./node_modules/@dmail/server/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
      "@jsenv/core/": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/core": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/index.js",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js",
      "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
      "rollup": "./node_modules/rollup/dist/rollup.es.js",
      "terser": "./node_modules/terser/dist/bundle.min.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/url-meta/": {
      "@jsenv/import-map": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/url-meta/node_modules/@jsenv/import-map/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/babel-plugin-map/node_modules/@babel/core/": {
      "convert-source-map": "./node_modules/convert-source-map/index.js",
      "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
      "@babel/generator": "./node_modules/@babel/generator/lib/index.js",
      "@babel/template": "./node_modules/@babel/template/lib/index.js",
      "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
      "@babel/helpers": "./node_modules/@babel/helpers/lib/index.js",
      "@babel/parser": "./node_modules/@babel/parser/lib/index.js",
      "@babel/types": "./node_modules/@babel/types/lib/index.js",
      "source-map": "./node_modules/source-map/source-map.js",
      "resolve": "./node_modules/resolve/index.js",
      "lodash": "./node_modules/lodash/lodash.js",
      "semver": "./node_modules/semver/semver.js",
      "debug": "./node_modules/debug/src/index.js",
      "json5": "./node_modules/json5/lib/index.js"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@babel/helpers/": {
      "@babel/template": "./node_modules/@jsenv/node-launcher/node_modules/@babel/template/lib/index.js",
      "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
      "@babel/types": "./node_modules/@jsenv/node-launcher/node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-exponentiation-operator/": {
      "@babel/helper-builder-binary-assignment-operator-visitor": "./node_modules/@babel/helper-builder-binary-assignment-operator-visitor/lib/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/istanbul-lib-report/node_modules/supports-color/": {
      "has-flag": "./node_modules/istanbul-lib-report/node_modules/has-flag/index.js"
    },
    "./node_modules/@babel/plugin-transform-block-scoped-functions/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@jsenv/bundling/node_modules/@jsenv/import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@babel/types/": {
      "to-fast-properties": "./node_modules/to-fast-properties/index.js",
      "esutils": "./node_modules/esutils/lib/utils.js",
      "lodash": "./node_modules/lodash/lodash.js"
    },
    "./node_modules/@jsenv/url-meta/node_modules/@jsenv/import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href": "./node_modules/@jsenv/url-meta/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/eslint-import-resolver-node/node_modules/debug/": {
      "ms": "./node_modules/eslint-import-resolver-node/node_modules/ms/index.js"
    },
    "./node_modules/@babel/plugin-proposal-optional-catch-binding/": {
      "@babel/plugin-syntax-optional-catch-binding": "./node_modules/@babel/plugin-syntax-optional-catch-binding/lib/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-proposal-unicode-property-regex/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/helper-regex": "./node_modules/@babel/helper-regex/lib/index.js",
      "regexpu-core": "./node_modules/regexpu-core/rewrite-pattern.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@jsenv/commonjs-converter/node_modules/rollup/": {
      "acorn": "./node_modules/acorn/dist/acorn.mjs"
    },
    "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/": {
      "@babel/plugin-transform-modules-systemjs": "./node_modules/@babel/plugin-transform-modules-systemjs/lib/index.js",
      "@babel/plugin-syntax-dynamic-import": "./node_modules/@babel/plugin-syntax-dynamic-import/lib/index.js",
      "@babel/plugin-syntax-import-meta": "./node_modules/@babel/plugin-syntax-import-meta/lib/index.js",
      "babel-plugin-transform-commonjs": "./node_modules/babel-plugin-transform-commonjs/dist/index.js",
      "@babel/helper-hoist-variables": "./node_modules/@babel/helper-hoist-variables/lib/index.js",
      "@jsenv/operating-system-path": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/operating-system-path/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "regenerator-runtime": "./node_modules/regenerator-runtime/runtime.js",
      "@jsenv/import-map": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/import-map/index.js",
      "@jsenv/url-meta": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/url-meta/index.js",
      "proper-lockfile": "./node_modules/proper-lockfile/index.js",
      "@babel/helpers": "./node_modules/@jsenv/node-launcher/node_modules/@babel/helpers/lib/index.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/logger/index.js",
      "ansi-to-html": "./node_modules/ansi-to-html/lib/ansi_to_html.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js",
      "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/href/index.js",
      "rimraf": "./node_modules/rimraf/rimraf.js",
      "/": "/"
    },
    "./node_modules/@babel/helper-member-expression-to-functions/": {
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@babel/helpers/node_modules/@babel/generator/": {
      "@babel/types": "./node_modules/@babel/helpers/node_modules/@babel/types/lib/index.js",
      "source-map": "./node_modules/source-map/source-map.js",
      "lodash": "./node_modules/lodash/lodash.js",
      "jsesc": "./node_modules/jsesc/jsesc.js"
    },
    "./node_modules/@babel/plugin-transform-shorthand-properties/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/helper-explode-assignable-expression/": {
      "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@babel/helpers/node_modules/@babel/template/": {
      "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
      "@babel/parser": "./node_modules/@babel/helpers/node_modules/@babel/parser/lib/index.js",
      "@babel/types": "./node_modules/@babel/helpers/node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@babel/helpers/node_modules/@babel/traverse/": {
      "@babel/helper-split-export-declaration": "./node_modules/@babel/helper-split-export-declaration/lib/index.js",
      "@babel/helper-function-name": "./node_modules/@babel/helper-function-name/lib/index.js",
      "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
      "@babel/generator": "./node_modules/@babel/helpers/node_modules/@babel/generator/lib/index.js",
      "@babel/parser": "./node_modules/@babel/helpers/node_modules/@babel/parser/lib/index.js",
      "@babel/types": "./node_modules/@babel/helpers/node_modules/@babel/types/lib/index.js",
      "globals": "./node_modules/globals/index.js",
      "lodash": "./node_modules/lodash/lodash.js",
      "debug": "./node_modules/debug/src/index.js"
    },
    "./node_modules/@babel/plugin-syntax-optional-catch-binding/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-computed-properties/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/level-sublevel/node_modules/level-fix-range/": {
      "clone": "./node_modules/clone/clone.js"
    },
    "./node_modules/@babel/generator/node_modules/@babel/types/": {
      "to-fast-properties": "./node_modules/to-fast-properties/index.js",
      "esutils": "./node_modules/esutils/lib/utils.js",
      "lodash": "./node_modules/lodash/lodash.js"
    },
    "./node_modules/@jsenv/core/node_modules/@jsenv/import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js"
    },
    "./node_modules/@babel/core/node_modules/@babel/generator/": {
      "@babel/types": "./node_modules/@babel/core/node_modules/@babel/types/lib/index.js",
      "source-map": "./node_modules/source-map/source-map.js",
      "lodash": "./node_modules/lodash/lodash.js",
      "jsesc": "./node_modules/jsesc/jsesc.js"
    },
    "./node_modules/@babel/plugin-proposal-object-rest-spread/": {
      "@babel/plugin-syntax-object-rest-spread": "./node_modules/@babel/plugin-syntax-object-rest-spread/lib/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-template-literals/": {
      "@babel/helper-annotate-as-pure": "./node_modules/@babel/helper-annotate-as-pure/lib/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/traverse/node_modules/@babel/types/": {
      "to-fast-properties": "./node_modules/to-fast-properties/index.js",
      "esutils": "./node_modules/esutils/lib/utils.js",
      "lodash": "./node_modules/lodash/lodash.js"
    },
    "./node_modules/@jsenv/compile-server/node_modules/rollup/": {
      "acorn": "./node_modules/@jsenv/compile-server/node_modules/acorn/dist/acorn.mjs"
    },
    "./node_modules/eslint-plugin-react/node_modules/doctrine/": {
      "esutils": "./node_modules/esutils/lib/utils.js"
    },
    "./node_modules/@babel/core/node_modules/@babel/template/": {
      "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
      "@babel/parser": "./node_modules/@babel/core/node_modules/@babel/parser/lib/index.js",
      "@babel/types": "./node_modules/@babel/core/node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@babel/core/node_modules/@babel/traverse/": {
      "@babel/helper-split-export-declaration": "./node_modules/@babel/helper-split-export-declaration/lib/index.js",
      "@babel/helper-function-name": "./node_modules/@babel/helper-function-name/lib/index.js",
      "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
      "@babel/generator": "./node_modules/@babel/core/node_modules/@babel/generator/lib/index.js",
      "@babel/parser": "./node_modules/@babel/core/node_modules/@babel/parser/lib/index.js",
      "@babel/types": "./node_modules/@babel/core/node_modules/@babel/types/lib/index.js",
      "globals": "./node_modules/globals/index.js",
      "lodash": "./node_modules/lodash/lodash.js",
      "debug": "./node_modules/debug/src/index.js"
    },
    "./node_modules/@babel/helpers/node_modules/@babel/types/": {
      "to-fast-properties": "./node_modules/to-fast-properties/index.js",
      "esutils": "./node_modules/esutils/lib/utils.js",
      "lodash": "./node_modules/lodash/lodash.js"
    },
    "./node_modules/@babel/plugin-transform-modules-systemjs/": {
      "babel-plugin-dynamic-import-node": "./node_modules/babel-plugin-dynamic-import-node/lib/index.js",
      "@babel/helper-hoist-variables": "./node_modules/@babel/helper-hoist-variables/lib/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@dmail/server/node_modules/@jsenv/logger/": {
      "@jsenv/href": "./node_modules/@dmail/server/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/core/node_modules/@babel/template/": {
      "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
      "@babel/parser": "./node_modules/@jsenv/core/node_modules/@babel/parser/lib/index.js",
      "@babel/types": "./node_modules/@jsenv/core/node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/level-blobs/node_modules/readable-stream/": {
      "string_decoder": "./node_modules/level-blobs/node_modules/string_decoder/index.js",
      "core-util-is": "./node_modules/core-util-is/lib/util.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "isarray": "./node_modules/level-blobs/node_modules/isarray/index.js"
    },
    "./node_modules/@babel/plugin-syntax-object-rest-spread/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-arrow-functions/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@jsenv/core/node_modules/@babel/helpers/": {
      "@babel/template": "./node_modules/@jsenv/core/node_modules/@babel/template/lib/index.js",
      "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
      "@babel/types": "./node_modules/@jsenv/core/node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/eslint-plugin-import/node_modules/debug/": {
      "ms": "./node_modules/eslint-plugin-import/node_modules/ms/index.js"
    },
    "./node_modules/fwd-stream/node_modules/readable-stream/": {
      "string_decoder": "./node_modules/fwd-stream/node_modules/string_decoder/index.js",
      "core-util-is": "./node_modules/core-util-is/lib/util.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "isarray": "./node_modules/fwd-stream/node_modules/isarray/index.js"
    },
    "./node_modules/level-sublevel/node_modules/object-keys/": {
      "foreach": "./node_modules/foreach/index.js",
      "indexof": "./node_modules/indexof/index.js",
      "is": "./node_modules/is/index.js"
    },
    "./node_modules/@babel/helper-optimise-call-expression/": {
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@babel/helper-split-export-declaration/": {
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-duplicate-keys/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/eslint-module-utils/node_modules/debug/": {
      "ms": "./node_modules/eslint-module-utils/node_modules/ms/index.js"
    },
    "./node_modules/@babel/core/node_modules/@babel/types/": {
      "to-fast-properties": "./node_modules/to-fast-properties/index.js",
      "esutils": "./node_modules/esutils/lib/utils.js",
      "lodash": "./node_modules/lodash/lodash.js"
    },
    "./node_modules/@babel/plugin-transform-block-scoping/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js",
      "lodash": "./node_modules/lodash/lodash.js"
    },
    "./node_modules/@babel/plugin-transform-destructuring/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-function-name/": {
      "@babel/helper-function-name": "./node_modules/@babel/helper-function-name/lib/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-typeof-symbol/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-unicode-regex/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/helper-regex": "./node_modules/@babel/helper-regex/lib/index.js",
      "regexpu-core": "./node_modules/regexpu-core/rewrite-pattern.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@jsenv/core/node_modules/@babel/types/": {
      "to-fast-properties": "./node_modules/to-fast-properties/index.js",
      "esutils": "./node_modules/esutils/lib/utils.js",
      "lodash": "./node_modules/lodash/lodash.js"
    },
    "./node_modules/@babel/plugin-transform-dotall-regex/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/helper-regex": "./node_modules/@babel/helper-regex/lib/index.js",
      "regexpu-core": "./node_modules/regexpu-core/rewrite-pattern.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-object-super/": {
      "@babel/helper-replace-supers": "./node_modules/@babel/helper-replace-supers/lib/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-sticky-regex/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/helper-regex": "./node_modules/@babel/helper-regex/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/https-proxy-agent/node_modules/debug/": {
      "ms": "./node_modules/ms/index.js"
    },
    "./node_modules/levelup/node_modules/readable-stream/": {
      "string_decoder": "./node_modules/levelup/node_modules/string_decoder/index.js",
      "core-util-is": "./node_modules/core-util-is/lib/util.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "isarray": "./node_modules/levelup/node_modules/isarray/index.js"
    },
    "./node_modules/string-width/node_modules/strip-ansi/": {
      "ansi-regex": "./node_modules/ansi-regex/index.js"
    },
    "./node_modules/@babel/plugin-proposal-json-strings/": {
      "@babel/plugin-syntax-json-strings": "./node_modules/@babel/plugin-syntax-json-strings/lib/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-syntax-dynamic-import/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-regenerator/": {
      "regenerator-transform": "./node_modules/regenerator-transform/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-new-target/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-parameters/": {
      "@babel/helper-get-function-arity": "./node_modules/@babel/helper-get-function-arity/lib/index.js",
      "@babel/helper-call-delegate": "./node_modules/@babel/helper-call-delegate/lib/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-syntax-json-strings/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-react-jsx/": {
      "@babel/helper-builder-react-jsx": "./node_modules/@babel/helper-builder-react-jsx/lib/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/plugin-syntax-jsx": "./node_modules/@babel/plugin-syntax-jsx/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/level-sublevel/node_modules/xtend/": {
      "object-keys": "./node_modules/level-sublevel/node_modules/object-keys/index.js",
      "is-object": "./node_modules/is-object/index.js"
    },
    "./node_modules/unicode-match-property-ecmascript/": {
      "unicode-canonical-property-names-ecmascript": "./node_modules/unicode-canonical-property-names-ecmascript/index.js",
      "unicode-property-aliases-ecmascript": "./node_modules/unicode-property-aliases-ecmascript/index.js"
    },
    "./node_modules/@babel/helper-get-function-arity/": {
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@babel/plugin-syntax-import-meta/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-literals/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/babel-plugin-dynamic-import-node/": {
      "object.assign": "./node_modules/object.assign/index.js"
    },
    "./node_modules/eslint/node_modules/eslint-scope/": {
      "estraverse": "./node_modules/estraverse/estraverse.js",
      "esrecurse": "./node_modules/esrecurse/esrecurse.js"
    },
    "./node_modules/@babel/helper-builder-react-jsx/": {
      "@babel/types": "./node_modules/@babel/types/lib/index.js",
      "esutils": "./node_modules/esutils/lib/utils.js"
    },
    "./node_modules/@babel/plugin-transform-classes/": {
      "@babel/helper-optimise-call-expression": "./node_modules/@babel/helper-optimise-call-expression/lib/index.js",
      "@babel/helper-split-export-declaration": "./node_modules/@babel/helper-split-export-declaration/lib/index.js",
      "@babel/helper-annotate-as-pure": "./node_modules/@babel/helper-annotate-as-pure/lib/index.js",
      "@babel/helper-replace-supers": "./node_modules/@babel/helper-replace-supers/lib/index.js",
      "@babel/helper-function-name": "./node_modules/@babel/helper-function-name/lib/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/helper-define-map": "./node_modules/@babel/helper-define-map/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js",
      "globals": "./node_modules/globals/index.js"
    },
    "./node_modules/babel-plugin-transform-commonjs/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/bl/node_modules/readable-stream/": {
      "string_decoder": "./node_modules/bl/node_modules/string_decoder/index.js",
      "core-util-is": "./node_modules/core-util-is/lib/util.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "isarray": "./node_modules/bl/node_modules/isarray/index.js"
    },
    "./node_modules/table/node_modules/string-width/": {
      "is-fullwidth-code-point": "./node_modules/is-fullwidth-code-point/index.js",
      "emoji-regex": "./node_modules/emoji-regex/index.js",
      "strip-ansi": "./node_modules/strip-ansi/index.js"
    },
    "./node_modules/@babel/helper-annotate-as-pure/": {
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-for-of/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@babel/plugin-transform-spread/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/extract-zip/node_modules/debug/": {
      "ms": "./node_modules/extract-zip/node_modules/ms/index.js"
    },
    "./node_modules/flat-cache/node_modules/rimraf/": {
      "glob": "./node_modules/glob/glob.js"
    },
    "./node_modules/@babel/helper-hoist-variables/": {
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@jsenv/eslint-import-resolver/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/import-map": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/import-map/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/logger/index.js",
      "@jsenv/href": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/node-module-import-map/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/import-map": "./node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/index.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/logger/index.js",
      "/": "/"
    },
    "./node_modules/@jsenv/prettier-check-project/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/prettier-check-project/node_modules/@jsenv/operating-system-path/index.js",
      "@dmail/filesystem-matching": "./node_modules/@dmail/filesystem-matching/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/url-meta": "./node_modules/@jsenv/prettier-check-project/node_modules/@jsenv/url-meta/index.js",
      "prettier": "./node_modules/prettier/index.js"
    },
    "./node_modules/puppeteer/node_modules/rimraf/": {
      "glob": "./node_modules/glob/glob.js"
    },
    "./node_modules/regenerate-unicode-properties/": {
      "regenerate": "./node_modules/regenerate/regenerate.js"
    },
    "./node_modules/@babel/helper-module-imports/": {
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@babel/helper-replace-supers/": {
      "@babel/helper-member-expression-to-functions": "./node_modules/@babel/helper-member-expression-to-functions/lib/index.js",
      "@babel/helper-optimise-call-expression": "./node_modules/@babel/helper-optimise-call-expression/lib/index.js",
      "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@jsenv/error-stack-sourcemap/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js",
      "source-map": "./node_modules/@jsenv/error-stack-sourcemap/node_modules/source-map/source-map.js"
    },
    "./node_modules/@jsenv/operating-system-path/": {
      "@jsenv/href": "./node_modules/@jsenv/operating-system-path/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/eslint/node_modules/doctrine/": {
      "esutils": "./node_modules/esutils/lib/utils.js"
    },
    "./node_modules/validate-npm-package-license/": {
      "spdx-expression-parse": "./node_modules/spdx-expression-parse/index.js",
      "spdx-correct": "./node_modules/spdx-correct/index.js"
    },
    "./node_modules/@babel/helper-call-delegate/": {
      "@babel/helper-hoist-variables": "./node_modules/@babel/helper-hoist-variables/lib/index.js",
      "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@babel/helper-function-name/": {
      "@babel/helper-get-function-arity": "./node_modules/@babel/helper-get-function-arity/lib/index.js",
      "@babel/template": "./node_modules/@babel/template/lib/index.js",
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/eslint-import-resolver-node/": {
      "resolve": "./node_modules/resolve/index.js",
      "debug": "./node_modules/eslint-import-resolver-node/node_modules/debug/src/index.js"
    },
    "./node_modules/level-js/node_modules/xtend/": {
      "object-keys": "./node_modules/level-js/node_modules/object-keys/index.js"
    },
    "./node_modules/rollup-plugin-node-builtins/": {
      "crypto-browserify": "./node_modules/crypto-browserify/index.js",
      "browserify-fs": "./node_modules/browserify-fs/index.js",
      "process-es6": "./node_modules/process-es6/browser.js",
      "buffer-es6": "./node_modules/buffer-es6/index.js"
    },
    "./node_modules/@dmail/filesystem-matching/": {
      "@jsenv/operating-system-path": "./node_modules/@dmail/filesystem-matching/node_modules/@jsenv/operating-system-path/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/url-meta": "./node_modules/@dmail/filesystem-matching/node_modules/@jsenv/url-meta/index.js"
    },
    "./node_modules/rollup-plugin-node-globals/": {
      "rollup-pluginutils": "./node_modules/rollup-pluginutils/dist/pluginutils.es.js",
      "estree-walker": "./node_modules/rollup-plugin-node-globals/node_modules/estree-walker/dist/estree-walker.es.js",
      "magic-string": "./node_modules/rollup-plugin-node-globals/node_modules/magic-string/dist/magic-string.es.js",
      "process-es6": "./node_modules/process-es6/browser.js",
      "buffer-es6": "./node_modules/buffer-es6/index.js",
      "acorn": "./node_modules/rollup-plugin-node-globals/node_modules/acorn/dist/acorn.es.js"
    },
    "./node_modules/rollup-plugin-node-resolve/": {
      "rollup-pluginutils": "./node_modules/rollup-pluginutils/dist/pluginutils.es.js",
      "builtin-modules": "./node_modules/builtin-modules/index.js",
      "is-module": "./node_modules/is-module/index.js",
      "resolve": "./node_modules/resolve/index.js",
      "rollup": "./node_modules/rollup/dist/rollup.es.js"
    },
    "./node_modules/string.prototype.trimright/": {
      "define-properties": "./node_modules/define-properties/index.js",
      "function-bind": "./node_modules/function-bind/index.js"
    },
    "./node_modules/@jsenv/commonjs-converter/": {
      "babel-plugin-transform-commonjs": "./node_modules/@jsenv/commonjs-converter/node_modules/babel-plugin-transform-commonjs/dist/index.js",
      "@jsenv/operating-system-path": "./node_modules/@jsenv/commonjs-converter/node_modules/@jsenv/operating-system-path/index.js",
      "rollup-plugin-node-builtins": "./node_modules/rollup-plugin-node-builtins/dist/rollup-plugin-node-builtins.es6.js",
      "rollup-plugin-node-globals": "./node_modules/rollup-plugin-node-globals/dist/rollup-plugin-node-globals.es6.js",
      "rollup-plugin-node-resolve": "./node_modules/rollup-plugin-node-resolve/dist/rollup-plugin-node-resolve.es.js",
      "rollup-plugin-commonjs": "./node_modules/rollup-plugin-commonjs/dist/rollup-plugin-commonjs.es.js",
      "rollup-plugin-replace": "./node_modules/rollup-plugin-replace/dist/rollup-plugin-replace.es.js",
      "rollup-plugin-json": "./node_modules/rollup-plugin-json/dist/rollup-plugin-json.es.js",
      "@jsenv/href": "./node_modules/@jsenv/commonjs-converter/node_modules/@jsenv/href/index.js",
      "rollup": "./node_modules/@jsenv/commonjs-converter/node_modules/rollup/dist/rollup.es.js",
      "/": "/"
    },
    "./node_modules/string.prototype.trimleft/": {
      "define-properties": "./node_modules/define-properties/index.js",
      "function-bind": "./node_modules/function-bind/index.js"
    },
    "./node_modules/@babel/helper-define-map/": {
      "@babel/helper-function-name": "./node_modules/@babel/helper-function-name/lib/index.js",
      "@babel/types": "./node_modules/@babel/types/lib/index.js",
      "lodash": "./node_modules/lodash/lodash.js"
    },
    "./node_modules/@babel/plugin-syntax-jsx/": {
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@jsenv/chromium-launcher/": {
      "@jsenv/error-stack-sourcemap/": "./node_modules/@jsenv/error-stack-sourcemap/",
      "@jsenv/error-stack-sourcemap": "./node_modules/@jsenv/error-stack-sourcemap/index.js",
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
      "@dmail/process-signals": "./node_modules/@dmail/process-signals/index.js",
      "@jsenv/compile-server/": "./node_modules/@jsenv/compile-server/",
      "@jsenv/compile-server": "./node_modules/@jsenv/compile-server/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/import-map/": "./node_modules/@jsenv/chromium-launcher/node_modules/@jsenv/import-map/",
      "@jsenv/import-map": "./node_modules/@jsenv/chromium-launcher/node_modules/@jsenv/import-map/index.js",
      "@dmail/server": "./node_modules/@dmail/server/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js",
      "source-map": "./node_modules/@jsenv/chromium-launcher/node_modules/source-map/source-map.js",
      "puppeteer": "./node_modules/puppeteer/index.js"
    },
    "./node_modules/@dmail/filesystem-watch/": {
      "@jsenv/operating-system-path": "./node_modules/@dmail/filesystem-watch/node_modules/@jsenv/operating-system-path/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/url-meta": "./node_modules/@dmail/filesystem-watch/node_modules/@jsenv/url-meta/index.js"
    },
    "./node_modules/@jsenv/babel-plugin-map/": {
      "@babel/plugin-transform-exponentiation-operator": "./node_modules/@babel/plugin-transform-exponentiation-operator/lib/index.js",
      "@babel/plugin-transform-block-scoped-functions": "./node_modules/@babel/plugin-transform-block-scoped-functions/lib/index.js",
      "@babel/plugin-proposal-optional-catch-binding": "./node_modules/@babel/plugin-proposal-optional-catch-binding/lib/index.js",
      "@babel/plugin-proposal-unicode-property-regex": "./node_modules/@babel/plugin-proposal-unicode-property-regex/lib/index.js",
      "@babel/plugin-transform-shorthand-properties": "./node_modules/@babel/plugin-transform-shorthand-properties/lib/index.js",
      "@babel/plugin-syntax-optional-catch-binding": "./node_modules/@babel/plugin-syntax-optional-catch-binding/lib/index.js",
      "@babel/plugin-transform-computed-properties": "./node_modules/@babel/plugin-transform-computed-properties/lib/index.js",
      "@babel/plugin-proposal-object-rest-spread": "./node_modules/@babel/plugin-proposal-object-rest-spread/lib/index.js",
      "@babel/plugin-transform-template-literals": "./node_modules/@babel/plugin-transform-template-literals/lib/index.js",
      "babel-plugin-transform-async-to-promises": "./node_modules/babel-plugin-transform-async-to-promises/async-to-promises.js",
      "@babel/plugin-syntax-object-rest-spread": "./node_modules/@babel/plugin-syntax-object-rest-spread/lib/index.js",
      "@babel/plugin-transform-arrow-functions": "./node_modules/@babel/plugin-transform-arrow-functions/lib/index.js",
      "@babel/plugin-transform-duplicate-keys": "./node_modules/@babel/plugin-transform-duplicate-keys/lib/index.js",
      "@babel/plugin-transform-block-scoping": "./node_modules/@babel/plugin-transform-block-scoping/lib/index.js",
      "@babel/plugin-transform-destructuring": "./node_modules/@babel/plugin-transform-destructuring/lib/index.js",
      "@babel/plugin-transform-function-name": "./node_modules/@babel/plugin-transform-function-name/lib/index.js",
      "@babel/plugin-transform-typeof-symbol": "./node_modules/@babel/plugin-transform-typeof-symbol/lib/index.js",
      "@babel/plugin-transform-unicode-regex": "./node_modules/@babel/plugin-transform-unicode-regex/lib/index.js",
      "@babel/plugin-transform-dotall-regex": "./node_modules/@babel/plugin-transform-dotall-regex/lib/index.js",
      "@babel/plugin-transform-object-super": "./node_modules/@babel/plugin-transform-object-super/lib/index.js",
      "@babel/plugin-transform-sticky-regex": "./node_modules/@babel/plugin-transform-sticky-regex/lib/index.js",
      "@babel/plugin-proposal-json-strings": "./node_modules/@babel/plugin-proposal-json-strings/lib/index.js",
      "@babel/plugin-transform-regenerator": "./node_modules/@babel/plugin-transform-regenerator/lib/index.js",
      "@babel/plugin-transform-new-target": "./node_modules/@babel/plugin-transform-new-target/lib/index.js",
      "@babel/plugin-transform-parameters": "./node_modules/@babel/plugin-transform-parameters/lib/index.js",
      "@babel/plugin-transform-literals": "./node_modules/@babel/plugin-transform-literals/lib/index.js",
      "@babel/plugin-transform-classes": "./node_modules/@babel/plugin-transform-classes/lib/index.js",
      "@babel/plugin-transform-for-of": "./node_modules/@babel/plugin-transform-for-of/lib/index.js",
      "@babel/plugin-transform-spread": "./node_modules/@babel/plugin-transform-spread/lib/index.js",
      "@babel/core": "./node_modules/@jsenv/babel-plugin-map/node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/istanbul-lib-instrument/": {
      "istanbul-lib-coverage": "./node_modules/istanbul-lib-coverage/index.js",
      "@babel/generator": "./node_modules/@babel/generator/lib/index.js",
      "@babel/template": "./node_modules/@babel/template/lib/index.js",
      "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
      "@babel/parser": "./node_modules/@babel/parser/lib/index.js",
      "@babel/types": "./node_modules/@babel/types/lib/index.js",
      "semver": "./node_modules/istanbul-lib-instrument/node_modules/semver/semver.js"
    },
    "./node_modules/@dmail/process-signals/": {
      "@dmail/helper": "./node_modules/@dmail/helper/index.js"
    },
    "./node_modules/normalize-package-data/": {
      "validate-npm-package-license": "./node_modules/validate-npm-package-license/index.js",
      "hosted-git-info": "./node_modules/hosted-git-info/index.js",
      "resolve": "./node_modules/resolve/index.js",
      "semver": "./node_modules/semver/semver.js"
    },
    "./node_modules/rollup-plugin-commonjs/": {
      "rollup-pluginutils": "./node_modules/rollup-pluginutils/dist/pluginutils.es.js",
      "estree-walker": "./node_modules/estree-walker/src/estree-walker.js",
      "is-reference": "./node_modules/is-reference/dist/is-reference.es.js",
      "magic-string": "./node_modules/magic-string/dist/magic-string.es.js",
      "resolve": "./node_modules/resolve/index.js",
      "rollup": "./node_modules/rollup/dist/rollup.es.js"
    },
    "./node_modules/@jsenv/codecov-upload/": {
      "codecov": "./node_modules/codecov/index.js"
    },
    "./node_modules/@jsenv/compile-server/": {
      "@jsenv/node-module-import-map": "./node_modules/@jsenv/node-module-import-map/index.js",
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@dmail/filesystem-watch": "./node_modules/@dmail/filesystem-watch/index.js",
      "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
      "@dmail/process-signals": "./node_modules/@dmail/process-signals/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/import-map/": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/import-map/",
      "@jsenv/import-map": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/import-map/index.js",
      "abort-controller": "./node_modules/abort-controller/dist/abort-controller.js",
      "@jsenv/bundling": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/index.js",
      "@jsenv/url-meta": "./node_modules/@jsenv/url-meta/index.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "@dmail/server": "./node_modules/@dmail/server/index.js",
      "@dmail/uneval": "./node_modules/@dmail/uneval/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
      "@jsenv/core/": "./node_modules/@jsenv/core/",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/core": "./node_modules/@jsenv/core/index.js",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js",
      "eventsource": "./node_modules/eventsource/lib/eventsource.js",
      "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
      "systemjs": "./node_modules/systemjs/index.js",
      "/": "/"
    },
    "./node_modules/regenerator-transform/": {
      "private": "./node_modules/private/private.js"
    },
    "./node_modules/rollup-plugin-replace/": {
      "rollup-pluginutils": "./node_modules/rollup-pluginutils/dist/pluginutils.es.js",
      "magic-string": "./node_modules/magic-string/dist/magic-string.es.js"
    },
    "./node_modules/spdx-expression-parse/": {
      "spdx-license-ids": "./node_modules/spdx-license-ids/index.json",
      "spdx-exceptions": "./node_modules/spdx-exceptions/index.json"
    },
    "./node_modules/@jsenv/eslint-config/": {
      "@babel/plugin-syntax-dynamic-import": "./node_modules/@babel/plugin-syntax-dynamic-import/lib/index.js",
      "@babel/plugin-syntax-import-meta": "./node_modules/@babel/plugin-syntax-import-meta/lib/index.js",
      "@jsenv/eslint-import-resolver": "./node_modules/@jsenv/eslint-import-resolver/index.js",
      "@babel/plugin-syntax-jsx": "./node_modules/@babel/plugin-syntax-jsx/lib/index.js",
      "eslint-plugin-import": "./node_modules/eslint-plugin-import/lib/index.js",
      "eslint-plugin-react": "./node_modules/eslint-plugin-react/index.js",
      "babel-eslint": "./node_modules/babel-eslint/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js"
    },
    "./node_modules/@jsenv/node-launcher/": {
      "@jsenv/node-module-import-map": "./node_modules/@jsenv/node-module-import-map/index.js",
      "@jsenv/error-stack-sourcemap": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/error-stack-sourcemap/index.js",
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
      "@dmail/process-signals": "./node_modules/@dmail/process-signals/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/import-map/": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/import-map/",
      "@jsenv/import-map": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/import-map/index.js",
      "abort-controller": "./node_modules/abort-controller/dist/abort-controller.js",
      "@jsenv/bundling": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/index.js",
      "@dmail/server": "./node_modules/@dmail/server/index.js",
      "@dmail/uneval": "./node_modules/@dmail/uneval/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
      "@jsenv/core/": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/core": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/index.js",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js",
      "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
      "source-map": "./node_modules/@jsenv/node-launcher/node_modules/source-map/source-map.js",
      "/": "/"
    },
    "./node_modules/eslint-plugin-import/": {
      "eslint-import-resolver-node": "./node_modules/eslint-import-resolver-node/index.js",
      "eslint-module-utils": "./node_modules/eslint-module-utils/index.js",
      "array-includes": "./node_modules/array-includes/index.js",
      "contains-path": "./node_modules/contains-path/index.js",
      "object.values": "./node_modules/object.values/index.js",
      "read-pkg-up": "./node_modules/read-pkg-up/index.js",
      "minimatch": "./node_modules/minimatch/minimatch.js",
      "doctrine": "./node_modules/doctrine/lib/doctrine.js",
      "resolve": "./node_modules/resolve/index.js",
      "eslint": "./node_modules/eslint/lib/api.js",
      "debug": "./node_modules/eslint-plugin-import/node_modules/debug/src/index.js",
      "has": "./node_modules/has/src/index.js"
    },
    "./node_modules/@babel/helper-regex/": {
      "lodash": "./node_modules/lodash/lodash.js"
    },
    "./node_modules/eslint-module-utils/": {
      "pkg-dir": "./node_modules/pkg-dir/index.js",
      "debug": "./node_modules/eslint-module-utils/node_modules/debug/src/index.js"
    },
    "./node_modules/eslint-plugin-react/": {
      "object.fromentries": "./node_modules/object.fromentries/index.js",
      "array-includes": "./node_modules/array-includes/index.js",
      "object.entries": "./node_modules/object.entries/index.js",
      "jsx-ast-utils": "./node_modules/jsx-ast-utils/lib/index.js",
      "object.values": "./node_modules/object.values/index.js",
      "prop-types": "./node_modules/prop-types/index.js",
      "doctrine": "./node_modules/eslint-plugin-react/node_modules/doctrine/lib/doctrine.js",
      "resolve": "./node_modules/resolve/index.js",
      "eslint": "./node_modules/eslint/lib/api.js",
      "has": "./node_modules/has/src/index.js"
    },
    "./node_modules/istanbul-lib-report/": {
      "istanbul-lib-coverage": "./node_modules/istanbul-lib-coverage/index.js",
      "supports-color": "./node_modules/istanbul-lib-report/node_modules/supports-color/index.js",
      "make-dir": "./node_modules/make-dir/index.js"
    },
    "./node_modules/abstract-leveldown/": {
      "xtend": "./node_modules/abstract-leveldown/node_modules/xtend/index.js"
    },
    "./node_modules/convert-source-map/": {
      "safe-buffer": "./node_modules/safe-buffer/index.js"
    },
    "./node_modules/deferred-leveldown/": {
      "abstract-leveldown": "./node_modules/abstract-leveldown/abstract-leveldown.js"
    },
    "./node_modules/object.fromentries/": {
      "define-properties": "./node_modules/define-properties/index.js",
      "function-bind": "./node_modules/function-bind/index.js",
      "es-abstract": "./node_modules/es-abstract/index.js",
      "has": "./node_modules/has/src/index.js"
    },
    "./node_modules/rollup-plugin-json/": {
      "rollup-pluginutils": "./node_modules/rollup-pluginutils/dist/pluginutils.es.js"
    },
    "./node_modules/rollup-pluginutils/": {
      "estree-walker": "./node_modules/estree-walker/src/estree-walker.js"
    },
    "./node_modules/source-map-support/": {
      "buffer-from": "./node_modules/buffer-from/index.js",
      "source-map": "./node_modules/source-map-support/node_modules/source-map/source-map.js"
    },
    "./node_modules/@babel/code-frame/": {
      "@babel/highlight": "./node_modules/@babel/highlight/lib/index.js"
    },
    "./node_modules/@jsenv/import-map/": {
      "@jsenv/href": "./node_modules/@jsenv/import-map/node_modules/@jsenv/href/index.js",
      "/": "/"
    },
    "./node_modules/browserify-cipher/": {
      "browserify-aes": "./node_modules/browserify-aes/index.js",
      "browserify-des": "./node_modules/browserify-des/index.js",
      "evp_bytestokey": "./node_modules/evp_bytestokey/index.js"
    },
    "./node_modules/crypto-browserify/": {
      "browserify-cipher": "./node_modules/browserify-cipher/index.js",
      "browserify-sign": "./node_modules/browserify-sign/index.js",
      "diffie-hellman": "./node_modules/diffie-hellman/index.js",
      "public-encrypt": "./node_modules/public-encrypt/index.js",
      "create-ecdh": "./node_modules/create-ecdh/index.js",
      "create-hash": "./node_modules/create-hash/index.js",
      "create-hmac": "./node_modules/create-hmac/index.js",
      "randombytes": "./node_modules/randombytes/index.js",
      "randomfill": "./node_modules/randomfill/index.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "pbkdf2": "./node_modules/pbkdf2/index.js"
    },
    "./node_modules/define-properties/": {
      "object-keys": "./node_modules/object-keys/index.js"
    },
    "./node_modules/https-proxy-agent/": {
      "agent-base": "./node_modules/agent-base/index.js",
      "debug": "./node_modules/https-proxy-agent/node_modules/debug/src/index.js"
    },
    "./node_modules/@babel/generator/": {
      "@babel/types": "./node_modules/@babel/generator/node_modules/@babel/types/lib/index.js",
      "source-map": "./node_modules/source-map/source-map.js",
      "lodash": "./node_modules/lodash/lodash.js",
      "jsesc": "./node_modules/jsesc/jsesc.js"
    },
    "./node_modules/@babel/highlight/": {
      "js-tokens": "./node_modules/js-tokens/index.js",
      "esutils": "./node_modules/esutils/lib/utils.js",
      "chalk": "./node_modules/chalk/index.js"
    },
    "./node_modules/@jsenv/execution/": {
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/compile-server/": "./node_modules/@jsenv/compile-server/",
      "@jsenv/compile-server": "./node_modules/@jsenv/compile-server/index.js",
      "istanbul-lib-coverage": "./node_modules/@jsenv/execution/node_modules/istanbul-lib-coverage/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js",
      "eventsource": "./node_modules/eventsource/lib/eventsource.js"
    },
    "./node_modules/abort-controller/": {
      "event-target-shim": "./node_modules/event-target-shim/dist/event-target-shim.js"
    },
    "./node_modules/file-entry-cache/": {
      "flat-cache": "./node_modules/flat-cache/cache.js"
    },
    "./node_modules/istanbul-reports/": {
      "handlebars": "./node_modules/handlebars/lib/index.js"
    },
    "./node_modules/level-filesystem/": {
      "level-sublevel": "./node_modules/level-sublevel/index.js",
      "concat-stream": "./node_modules/concat-stream/index.js",
      "level-blobs": "./node_modules/level-blobs/index.js",
      "fwd-stream": "./node_modules/fwd-stream/index.js",
      "level-peek": "./node_modules/level-peek/index.js",
      "errno": "./node_modules/errno/errno.js",
      "octal": "./node_modules/octal/index.js",
      "xtend": "./node_modules/xtend/index.js",
      "once": "./node_modules/once/once.js"
    },
    "./node_modules/@babel/template/": {
      "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
      "@babel/parser": "./node_modules/@babel/parser/lib/index.js",
      "@babel/types": "./node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@babel/traverse/": {
      "@babel/helper-split-export-declaration": "./node_modules/@babel/helper-split-export-declaration/lib/index.js",
      "@babel/helper-function-name": "./node_modules/@babel/helper-function-name/lib/index.js",
      "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
      "@babel/generator": "./node_modules/@babel/generator/lib/index.js",
      "@babel/parser": "./node_modules/@babel/traverse/node_modules/@babel/parser/lib/index.js",
      "@babel/types": "./node_modules/@babel/traverse/node_modules/@babel/types/lib/index.js",
      "globals": "./node_modules/globals/index.js",
      "lodash": "./node_modules/lodash/lodash.js",
      "debug": "./node_modules/debug/src/index.js"
    },
    "./node_modules/@jsenv/bundling/": {
      "@jsenv/node-module-import-map": "./node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/index.js",
      "@babel/helper-module-imports": "./node_modules/@babel/helper-module-imports/lib/index.js",
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@jsenv/import-map/": "./node_modules/@jsenv/bundling/node_modules/@jsenv/import-map/",
      "@jsenv/import-map": "./node_modules/@jsenv/bundling/node_modules/@jsenv/import-map/index.js",
      "abort-controller": "./node_modules/abort-controller/dist/abort-controller.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "@dmail/server": "./node_modules/@dmail/server/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
      "@jsenv/core/": "./node_modules/@jsenv/core/",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@jsenv/core": "./node_modules/@jsenv/core/index.js",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js",
      "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
      "rollup": "./node_modules/rollup/dist/rollup.es.js",
      "terser": "./node_modules/terser/dist/bundle.min.js",
      "/": "/"
    },
    "./node_modules/@jsenv/url-meta/": {
      "@jsenv/import-map": "./node_modules/@jsenv/url-meta/node_modules/@jsenv/import-map/index.js",
      "/": "/"
    },
    "./node_modules/brace-expansion/": {
      "balanced-match": "./node_modules/balanced-match/index.js",
      "concat-map": "./node_modules/concat-map/index.js"
    },
    "./node_modules/browserify-sign/": {
      "browserify-rsa": "./node_modules/browserify-rsa/index.js",
      "create-hash": "./node_modules/create-hash/index.js",
      "create-hmac": "./node_modules/create-hmac/index.js",
      "parse-asn1": "./node_modules/parse-asn1/index.js",
      "elliptic": "./node_modules/elliptic/lib/elliptic.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "bn.js": "./node_modules/bn.js/lib/bn.js"
    },
    "./node_modules/es-to-primitive/": {
      "is-date-object": "./node_modules/is-date-object/index.js",
      "is-callable": "./node_modules/is-callable/index.js",
      "is-symbol": "./node_modules/is-symbol/index.js"
    },
    "./node_modules/external-editor/": {
      "iconv-lite": "./node_modules/iconv-lite/lib/index.js",
      "chardet": "./node_modules/chardet/index.js",
      "tmp": "./node_modules/tmp/lib/tmp.js"
    },
    "./node_modules/proper-lockfile/": {
      "graceful-fs": "./node_modules/graceful-fs/graceful-fs.js",
      "signal-exit": "./node_modules/signal-exit/index.js",
      "retry": "./node_modules/retry/index.js"
    },
    "./node_modules/readable-stream/": {
      "process-nextick-args": "./node_modules/process-nextick-args/index.js",
      "string_decoder": "./node_modules/string_decoder/lib/string_decoder.js",
      "util-deprecate": "./node_modules/util-deprecate/node.js",
      "core-util-is": "./node_modules/core-util-is/lib/util.js",
      "safe-buffer": "./node_modules/safe-buffer/index.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "isarray": "./node_modules/isarray/index.js"
    },
    "./node_modules/shebang-command/": {
      "shebang-regex": "./node_modules/shebang-regex/index.js"
    },
    "./node_modules/@babel/helpers/": {
      "@babel/template": "./node_modules/@babel/helpers/node_modules/@babel/template/lib/index.js",
      "@babel/traverse": "./node_modules/@babel/helpers/node_modules/@babel/traverse/lib/index.js",
      "@babel/types": "./node_modules/@babel/helpers/node_modules/@babel/types/lib/index.js"
    },
    "./node_modules/@jsenv/testing/": {
      "@babel/plugin-syntax-dynamic-import": "./node_modules/@babel/plugin-syntax-dynamic-import/lib/index.js",
      "@babel/plugin-syntax-import-meta": "./node_modules/@babel/plugin-syntax-import-meta/lib/index.js",
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@dmail/filesystem-matching": "./node_modules/@dmail/filesystem-matching/index.js",
      "@dmail/filesystem-watch": "./node_modules/@dmail/filesystem-watch/index.js",
      "istanbul-lib-instrument": "./node_modules/istanbul-lib-instrument/dist/index.js",
      "@jsenv/compile-server/": "./node_modules/@jsenv/compile-server/",
      "@jsenv/compile-server": "./node_modules/@jsenv/compile-server/index.js",
      "istanbul-lib-coverage": "./node_modules/istanbul-lib-coverage/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "istanbul-lib-report": "./node_modules/istanbul-lib-report/index.js",
      "@jsenv/execution": "./node_modules/@jsenv/execution/index.js",
      "istanbul-reports": "./node_modules/istanbul-reports/index.js",
      "@jsenv/url-meta": "./node_modules/@jsenv/url-meta/index.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
      "node-notifier": "./node_modules/node-notifier/index.js",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "@babel/core": "./node_modules/@babel/core/lib/index.js",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js",
      "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
      "cuid": "./node_modules/cuid/index.js"
    },
    "./node_modules/array-includes/": {
      "define-properties": "./node_modules/define-properties/index.js",
      "es-abstract": "./node_modules/es-abstract/index.js"
    },
    "./node_modules/browserify-aes/": {
      "evp_bytestokey": "./node_modules/evp_bytestokey/index.js",
      "cipher-base": "./node_modules/cipher-base/index.js",
      "create-hash": "./node_modules/create-hash/index.js",
      "safe-buffer": "./node_modules/safe-buffer/index.js",
      "buffer-xor": "./node_modules/buffer-xor/index.js",
      "inherits": "./node_modules/inherits/inherits.js"
    },
    "./node_modules/browserify-des/": {
      "cipher-base": "./node_modules/cipher-base/index.js",
      "safe-buffer": "./node_modules/safe-buffer/index.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "des.js": "./node_modules/des.js/lib/des.js"
    },
    "./node_modules/browserify-rsa/": {
      "randombytes": "./node_modules/randombytes/index.js",
      "bn.js": "./node_modules/bn.js/lib/bn.js"
    },
    "./node_modules/diffie-hellman/": {
      "miller-rabin": "./node_modules/miller-rabin/lib/mr.js",
      "randombytes": "./node_modules/randombytes/index.js",
      "bn.js": "./node_modules/bn.js/lib/bn.js"
    },
    "./node_modules/evp_bytestokey/": {
      "safe-buffer": "./node_modules/safe-buffer/index.js",
      "md5.js": "./node_modules/md5.js/index.js"
    },
    "./node_modules/level-sublevel/": {
      "level-fix-range": "./node_modules/level-sublevel/node_modules/level-fix-range/index.js",
      "string-range": "./node_modules/string-range/index.js",
      "level-hooks": "./node_modules/level-hooks/index.js",
      "xtend": "./node_modules/level-sublevel/node_modules/xtend/index.js"
    },
    "./node_modules/load-json-file/": {
      "graceful-fs": "./node_modules/graceful-fs/graceful-fs.js",
      "parse-json": "./node_modules/parse-json/index.js",
      "strip-bom": "./node_modules/strip-bom/index.js",
      "pify": "./node_modules/pify/index.js"
    },
    "./node_modules/object.entries/": {
      "define-properties": "./node_modules/define-properties/index.js",
      "function-bind": "./node_modules/function-bind/index.js",
      "es-abstract": "./node_modules/es-abstract/index.js",
      "has": "./node_modules/has/src/index.js"
    },
    "./node_modules/public-encrypt/": {
      "browserify-rsa": "./node_modules/browserify-rsa/index.js",
      "create-hash": "./node_modules/create-hash/index.js",
      "randombytes": "./node_modules/randombytes/index.js",
      "safe-buffer": "./node_modules/safe-buffer/index.js",
      "parse-asn1": "./node_modules/parse-asn1/index.js",
      "bn.js": "./node_modules/bn.js/lib/bn.js"
    },
    "./node_modules/restore-cursor/": {
      "signal-exit": "./node_modules/signal-exit/index.js",
      "onetime": "./node_modules/onetime/index.js"
    },
    "./node_modules/string_decoder/": {
      "safe-buffer": "./node_modules/safe-buffer/index.js"
    },
    "./node_modules/supports-color/": {
      "has-flag": "./node_modules/has-flag/index.js"
    },
    "./node_modules/@dmail/assert/": {
      "@dmail/inspect": "./node_modules/@dmail/inspect/index.js"
    },
    "./node_modules/@dmail/server/": {
      "@jsenv/operating-system-path": "./node_modules/@dmail/server/node_modules/@jsenv/operating-system-path/index.js",
      "@dmail/process-signals": "./node_modules/@dmail/process-signals/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "@jsenv/logger": "./node_modules/@dmail/server/node_modules/@jsenv/logger/index.js",
      "@jsenv/href": "./node_modules/@dmail/server/node_modules/@jsenv/href/index.js",
      "kill-port": "./node_modules/kill-port/index.js",
      "/": "/"
    },
    "./node_modules/browserify-fs/": {
      "level-filesystem": "./node_modules/level-filesystem/index.js",
      "level-js": "./node_modules/level-js/index.js",
      "levelup": "./node_modules/levelup/lib/levelup.js"
    },
    "./node_modules/color-convert/": {
      "color-name": "./node_modules/color-name/index.js"
    },
    "./node_modules/concat-stream/": {
      "readable-stream": "./node_modules/readable-stream/readable.js",
      "buffer-from": "./node_modules/buffer-from/index.js",
      "typedarray": "./node_modules/typedarray/index.js",
      "inherits": "./node_modules/inherits/inherits.js"
    },
    "./node_modules/es6-promisify/": {
      "es6-promise": "./node_modules/es6-promise/dist/es6-promise.js"
    },
    "./node_modules/jsx-ast-utils/": {
      "array-includes": "./node_modules/array-includes/index.js",
      "object.assign": "./node_modules/object.assign/index.js"
    },
    "./node_modules/node-notifier/": {
      "shellwords": "./node_modules/shellwords/lib/shellwords.js",
      "growly": "./node_modules/growly/lib/growly.js",
      "is-wsl": "./node_modules/is-wsl/index.js",
      "semver": "./node_modules/semver/semver.js",
      "which": "./node_modules/which/which.js"
    },
    "./node_modules/object.assign/": {
      "define-properties": "./node_modules/define-properties/index.js",
      "function-bind": "./node_modules/function-bind/index.js",
      "has-symbols": "./node_modules/has-symbols/index.js",
      "object-keys": "./node_modules/object-keys/index.js"
    },
    "./node_modules/object.values/": {
      "define-properties": "./node_modules/define-properties/index.js",
      "function-bind": "./node_modules/function-bind/index.js",
      "es-abstract": "./node_modules/es-abstract/index.js",
      "has": "./node_modules/has/src/index.js"
    },
    "./node_modules/parent-module/": {
      "callsites": "./node_modules/callsites/index.js"
    },
    "./node_modules/teeny-request/": {
      "https-proxy-agent": "./node_modules/https-proxy-agent/index.js",
      "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
      "uuid": "./node_modules/uuid/index.js"
    },
    "./node_modules/@babel/types/": {
      "to-fast-properties": "./node_modules/to-fast-properties/index.js",
      "esutils": "./node_modules/esutils/lib/utils.js",
      "lodash": "./node_modules/lodash/lodash.js"
    },
    "./node_modules/ansi-to-html/": {
      "entities": "./node_modules/entities/index.js"
    },
    "./node_modules/babel-eslint/": {
      "eslint-visitor-keys": "./node_modules/eslint-visitor-keys/lib/index.js",
      "eslint-scope": "./node_modules/eslint-scope/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js",
      "eslint": "./node_modules/eslint/lib/api.js",
      "semver": "./node_modules/semver/semver.js"
    },
    "./node_modules/eslint-scope/": {
      "estraverse": "./node_modules/estraverse/estraverse.js",
      "esrecurse": "./node_modules/esrecurse/esrecurse.js"
    },
    "./node_modules/eslint-utils/": {
      "eslint-visitor-keys": "./node_modules/eslint-visitor-keys/lib/index.js"
    },
    "./node_modules/import-fresh/": {
      "parent-module": "./node_modules/parent-module/index.js",
      "resolve-from": "./node_modules/resolve-from/index.js"
    },
    "./node_modules/loose-envify/": {
      "js-tokens": "./node_modules/js-tokens/index.js"
    },
    "./node_modules/magic-string/": {
      "sourcemap-codec": "./node_modules/sourcemap-codec/dist/sourcemap-codec.es.js"
    },
    "./node_modules/miller-rabin/": {
      "brorand": "./node_modules/brorand/index.js",
      "bn.js": "./node_modules/bn.js/lib/bn.js"
    },
    "./node_modules/regexpu-core/": {
      "unicode-match-property-value-ecmascript": "./node_modules/unicode-match-property-value-ecmascript/index.js",
      "unicode-match-property-ecmascript": "./node_modules/unicode-match-property-ecmascript/index.js",
      "regenerate-unicode-properties": "./node_modules/regenerate-unicode-properties/index.js",
      "regjsparser": "./node_modules/regjsparser/parser.js",
      "regenerate": "./node_modules/regenerate/regenerate.js",
      "regjsgen": "./node_modules/regjsgen/regjsgen.js"
    },
    "./node_modules/spdx-correct/": {
      "spdx-expression-parse": "./node_modules/spdx-expression-parse/index.js",
      "spdx-license-ids": "./node_modules/spdx-license-ids/index.json"
    },
    "./node_modules/string-width/": {
      "is-fullwidth-code-point": "./node_modules/is-fullwidth-code-point/index.js",
      "strip-ansi": "./node_modules/string-width/node_modules/strip-ansi/index.js"
    },
    "./node_modules/@babel/core/": {
      "convert-source-map": "./node_modules/convert-source-map/index.js",
      "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
      "@babel/generator": "./node_modules/@babel/core/node_modules/@babel/generator/lib/index.js",
      "@babel/template": "./node_modules/@babel/core/node_modules/@babel/template/lib/index.js",
      "@babel/traverse": "./node_modules/@babel/core/node_modules/@babel/traverse/lib/index.js",
      "@babel/helpers": "./node_modules/@babel/helpers/lib/index.js",
      "@babel/parser": "./node_modules/@babel/core/node_modules/@babel/parser/lib/index.js",
      "@babel/types": "./node_modules/@babel/core/node_modules/@babel/types/lib/index.js",
      "source-map": "./node_modules/source-map/source-map.js",
      "resolve": "./node_modules/resolve/index.js",
      "lodash": "./node_modules/lodash/lodash.js",
      "semver": "./node_modules/semver/semver.js",
      "debug": "./node_modules/debug/src/index.js",
      "json5": "./node_modules/json5/lib/index.js"
    },
    "./node_modules/@jsenv/core/": {
      "@babel/plugin-transform-modules-systemjs": "./node_modules/@babel/plugin-transform-modules-systemjs/lib/index.js",
      "@babel/plugin-syntax-dynamic-import": "./node_modules/@babel/plugin-syntax-dynamic-import/lib/index.js",
      "@babel/plugin-syntax-import-meta": "./node_modules/@babel/plugin-syntax-import-meta/lib/index.js",
      "babel-plugin-transform-commonjs": "./node_modules/babel-plugin-transform-commonjs/dist/index.js",
      "@babel/helper-hoist-variables": "./node_modules/@babel/helper-hoist-variables/lib/index.js",
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
      "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "regenerator-runtime": "./node_modules/regenerator-runtime/runtime.js",
      "@jsenv/import-map/": "./node_modules/@jsenv/core/node_modules/@jsenv/import-map/",
      "@jsenv/import-map": "./node_modules/@jsenv/core/node_modules/@jsenv/import-map/index.js",
      "@jsenv/url-meta": "./node_modules/@jsenv/url-meta/index.js",
      "proper-lockfile": "./node_modules/proper-lockfile/index.js",
      "@babel/helpers": "./node_modules/@jsenv/core/node_modules/@babel/helpers/lib/index.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "ansi-to-html": "./node_modules/ansi-to-html/lib/ansi_to_html.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js",
      "rimraf": "./node_modules/rimraf/rimraf.js"
    },
    "./node_modules/ansi-styles/": {
      "color-convert": "./node_modules/color-convert/index.js"
    },
    "./node_modules/cipher-base/": {
      "safe-buffer": "./node_modules/safe-buffer/index.js",
      "inherits": "./node_modules/inherits/inherits.js"
    },
    "./node_modules/create-ecdh/": {
      "elliptic": "./node_modules/elliptic/lib/elliptic.js",
      "bn.js": "./node_modules/bn.js/lib/bn.js"
    },
    "./node_modules/create-hash/": {
      "cipher-base": "./node_modules/cipher-base/index.js",
      "ripemd160": "./node_modules/ripemd160/index.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "md5.js": "./node_modules/md5.js/index.js",
      "sha.js": "./node_modules/sha.js/index.js"
    },
    "./node_modules/create-hmac/": {
      "cipher-base": "./node_modules/cipher-base/index.js",
      "create-hash": "./node_modules/create-hash/index.js",
      "safe-buffer": "./node_modules/safe-buffer/index.js",
      "ripemd160": "./node_modules/ripemd160/index.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "sha.js": "./node_modules/sha.js/index.js"
    },
    "./node_modules/cross-spawn/": {
      "shebang-command": "./node_modules/shebang-command/index.js",
      "nice-try": "./node_modules/nice-try/src/index.js",
      "path-key": "./node_modules/path-key/index.js",
      "semver": "./node_modules/semver/semver.js",
      "which": "./node_modules/which/which.js"
    },
    "./node_modules/es-abstract/": {
      "string.prototype.trimright": "./node_modules/string.prototype.trimright/index.js",
      "string.prototype.trimleft": "./node_modules/string.prototype.trimleft/index.js",
      "es-to-primitive": "./node_modules/es-to-primitive/index.js",
      "object-inspect": "./node_modules/object-inspect/index.js",
      "function-bind": "./node_modules/function-bind/index.js",
      "has-symbols": "./node_modules/has-symbols/index.js",
      "is-callable": "./node_modules/is-callable/index.js",
      "object-keys": "./node_modules/object-keys/index.js",
      "is-regex": "./node_modules/is-regex/index.js",
      "has": "./node_modules/has/src/index.js"
    },
    "./node_modules/eventsource/": {
      "original": "./node_modules/original/index.js"
    },
    "./node_modules/extract-zip/": {
      "concat-stream": "./node_modules/concat-stream/index.js",
      "mkdirp": "./node_modules/mkdirp/index.js",
      "debug": "./node_modules/extract-zip/node_modules/debug/src/index.js",
      "yauzl": "./node_modules/yauzl/index.js"
    },
    "./node_modules/glob-parent/": {
      "is-glob": "./node_modules/is-glob/index.js"
    },
    "./node_modules/ignore-walk/": {
      "minimatch": "./node_modules/minimatch/minimatch.js"
    },
    "./node_modules/level-blobs/": {
      "readable-stream": "./node_modules/level-blobs/node_modules/readable-stream/readable.js",
      "level-peek": "./node_modules/level-peek/index.js",
      "once": "./node_modules/once/once.js"
    },
    "./node_modules/level-hooks/": {
      "string-range": "./node_modules/string-range/index.js"
    },
    "./node_modules/locate-path/": {
      "path-exists": "./node_modules/path-exists/index.js",
      "p-locate": "./node_modules/p-locate/index.js"
    },
    "./node_modules/randombytes/": {
      "safe-buffer": "./node_modules/safe-buffer/index.js"
    },
    "./node_modules/read-pkg-up/": {
      "read-pkg": "./node_modules/read-pkg/index.js",
      "find-up": "./node_modules/find-up/index.js"
    },
    "./node_modules/regjsparser/": {
      "jsesc": "./node_modules/regjsparser/node_modules/jsesc/jsesc.js"
    },
    "./node_modules/agent-base/": {
      "es6-promisify": "./node_modules/es6-promisify/dist/promisify.js"
    },
    "./node_modules/cli-cursor/": {
      "restore-cursor": "./node_modules/restore-cursor/index.js"
    },
    "./node_modules/flat-cache/": {
      "flatted": "./node_modules/flatted/esm/index.js",
      "rimraf": "./node_modules/flat-cache/node_modules/rimraf/rimraf.js",
      "write": "./node_modules/write/index.js"
    },
    "./node_modules/fwd-stream/": {
      "readable-stream": "./node_modules/fwd-stream/node_modules/readable-stream/readable.js"
    },
    "./node_modules/handlebars/": {
      "source-map": "./node_modules/handlebars/node_modules/source-map/source-map.js",
      "neo-async": "./node_modules/neo-async/async.js",
      "uglify-js": "./node_modules/uglify-js/tools/node.js",
      "optimist": "./node_modules/optimist/index.js"
    },
    "./node_modules/iconv-lite/": {
      "safer-buffer": "./node_modules/safer-buffer/safer.js"
    },
    "./node_modules/level-peek/": {
      "level-fix-range": "./node_modules/level-fix-range/index.js"
    },
    "./node_modules/optionator/": {
      "fast-levenshtein": "./node_modules/fast-levenshtein/levenshtein.js",
      "prelude-ls": "./node_modules/prelude-ls/lib/index.js",
      "type-check": "./node_modules/type-check/lib/index.js",
      "wordwrap": "./node_modules/wordwrap/index.js",
      "deep-is": "./node_modules/deep-is/index.js",
      "levn": "./node_modules/levn/lib/index.js"
    },
    "./node_modules/parse-asn1/": {
      "browserify-aes": "./node_modules/browserify-aes/index.js",
      "evp_bytestokey": "./node_modules/evp_bytestokey/index.js",
      "create-hash": "./node_modules/create-hash/index.js",
      "safe-buffer": "./node_modules/safe-buffer/index.js",
      "asn1.js": "./node_modules/asn1.js/lib/asn1.js",
      "pbkdf2": "./node_modules/pbkdf2/index.js"
    },
    "./node_modules/parse-json/": {
      "error-ex": "./node_modules/error-ex/index.js"
    },
    "./node_modules/prop-types/": {
      "object-assign": "./node_modules/object-assign/index.js",
      "loose-envify": "./node_modules/loose-envify/index.js",
      "react-is": "./node_modules/react-is/index.js"
    },
    "./node_modules/randomfill/": {
      "randombytes": "./node_modules/randombytes/index.js",
      "safe-buffer": "./node_modules/safe-buffer/index.js"
    },
    "./node_modules/slice-ansi/": {
      "is-fullwidth-code-point": "./node_modules/is-fullwidth-code-point/index.js",
      "astral-regex": "./node_modules/astral-regex/index.js",
      "ansi-styles": "./node_modules/ansi-styles/index.js"
    },
    "./node_modules/strip-ansi/": {
      "ansi-regex": "./node_modules/strip-ansi/node_modules/ansi-regex/index.js"
    },
    "./node_modules/type-check/": {
      "prelude-ls": "./node_modules/prelude-ls/lib/index.js"
    },
    "./node_modules/acorn-jsx/": {
      "acorn": "./node_modules/acorn/dist/acorn.mjs"
    },
    "./node_modules/esrecurse/": {
      "estraverse": "./node_modules/estraverse/estraverse.js"
    },
    "./node_modules/fd-slicer/": {
      "pend": "./node_modules/pend/index.js"
    },
    "./node_modules/hash-base/": {
      "safe-buffer": "./node_modules/safe-buffer/index.js",
      "inherits": "./node_modules/inherits/inherits.js"
    },
    "./node_modules/hmac-drbg/": {
      "minimalistic-crypto-utils": "./node_modules/minimalistic-crypto-utils/lib/utils.js",
      "minimalistic-assert": "./node_modules/minimalistic-assert/index.js",
      "hash.js": "./node_modules/hash.js/lib/hash.js"
    },
    "./node_modules/is-symbol/": {
      "has-symbols": "./node_modules/has-symbols/index.js"
    },
    "./node_modules/kill-port/": {
      "get-them-args": "./node_modules/get-them-args/index.js",
      "shell-exec": "./node_modules/shell-exec/index.js"
    },
    "./node_modules/minimatch/": {
      "brace-expansion": "./node_modules/brace-expansion/index.js"
    },
    "./node_modules/path-type/": {
      "pify": "./node_modules/pify/index.js"
    },
    "./node_modules/puppeteer/": {
      "https-proxy-agent": "./node_modules/https-proxy-agent/index.js",
      "proxy-from-env": "./node_modules/proxy-from-env/index.js",
      "extract-zip": "./node_modules/extract-zip/index.js",
      "progress": "./node_modules/progress/index.js",
      "rimraf": "./node_modules/puppeteer/node_modules/rimraf/rimraf.js",
      "debug": "./node_modules/debug/src/index.js",
      "mime": "./node_modules/mime/index.js",
      "ws": "./node_modules/ws/index.js"
    },
    "./node_modules/ripemd160/": {
      "hash-base": "./node_modules/hash-base/index.js",
      "inherits": "./node_modules/inherits/inherits.js"
    },
    "./node_modules/run-async/": {
      "is-promise": "./node_modules/is-promise/index.js"
    },
    "./node_modules/uglify-js/": {
      "source-map": "./node_modules/uglify-js/node_modules/source-map/source-map.js",
      "commander": "./node_modules/commander/index.js"
    },
    "./node_modules/url-parse/": {
      "querystringify": "./node_modules/querystringify/index.js",
      "requires-port": "./node_modules/requires-port/index.js"
    },
    "./node_modules/argparse/": {
      "sprintf-js": "./node_modules/sprintf-js/src/sprintf.js"
    },
    "./node_modules/doctrine/": {
      "esutils": "./node_modules/esutils/lib/utils.js",
      "isarray": "./node_modules/isarray/index.js"
    },
    "./node_modules/elliptic/": {
      "minimalistic-crypto-utils": "./node_modules/minimalistic-crypto-utils/lib/utils.js",
      "minimalistic-assert": "./node_modules/minimalistic-assert/index.js",
      "hmac-drbg": "./node_modules/hmac-drbg/lib/hmac-drbg.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "brorand": "./node_modules/brorand/index.js",
      "hash.js": "./node_modules/hash.js/lib/hash.js",
      "bn.js": "./node_modules/bn.js/lib/bn.js"
    },
    "./node_modules/error-ex/": {
      "is-arrayish": "./node_modules/is-arrayish/index.js"
    },
    "./node_modules/inflight/": {
      "wrappy": "./node_modules/wrappy/wrappy.js",
      "once": "./node_modules/once/once.js"
    },
    "./node_modules/inquirer/": {
      "external-editor": "./node_modules/external-editor/main/index.js",
      "ansi-escapes": "./node_modules/ansi-escapes/index.js",
      "string-width": "./node_modules/string-width/index.js",
      "mute-stream": "./node_modules/mute-stream/mute.js",
      "cli-cursor": "./node_modules/cli-cursor/index.js",
      "strip-ansi": "./node_modules/strip-ansi/index.js",
      "cli-width": "./node_modules/cli-width/index.js",
      "run-async": "./node_modules/run-async/index.js",
      "figures": "./node_modules/figures/index.js",
      "through": "./node_modules/through/index.js",
      "lodash": "./node_modules/lodash/lodash.js",
      "chalk": "./node_modules/chalk/index.js",
      "rxjs": "./node_modules/rxjs/_esm5/index.js"
    },
    "./node_modules/is-regex/": {
      "has": "./node_modules/has/src/index.js"
    },
    "./node_modules/level-js/": {
      "typedarray-to-buffer": "./node_modules/typedarray-to-buffer/index.js",
      "abstract-leveldown": "./node_modules/abstract-leveldown/abstract-leveldown.js",
      "idb-wrapper": "./node_modules/idb-wrapper/idbstore.js",
      "isbuffer": "./node_modules/isbuffer/index.js",
      "xtend": "./node_modules/level-js/node_modules/xtend/index.js",
      "ltgt": "./node_modules/ltgt/index.js"
    },
    "./node_modules/make-dir/": {
      "semver": "./node_modules/make-dir/node_modules/semver/semver.js"
    },
    "./node_modules/optimist/": {
      "minimist": "./node_modules/minimist/index.js",
      "wordwrap": "./node_modules/optimist/node_modules/wordwrap/index.js"
    },
    "./node_modules/original/": {
      "url-parse": "./node_modules/url-parse/index.js"
    },
    "./node_modules/p-locate/": {
      "p-limit": "./node_modules/p-limit/index.js"
    },
    "./node_modules/read-pkg/": {
      "normalize-package-data": "./node_modules/normalize-package-data/lib/normalize.js",
      "load-json-file": "./node_modules/load-json-file/index.js",
      "path-type": "./node_modules/path-type/index.js"
    },
    "./node_modules/asn1.js/": {
      "minimalistic-assert": "./node_modules/minimalistic-assert/index.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "bn.js": "./node_modules/bn.js/lib/bn.js"
    },
    "./node_modules/codecov/": {
      "teeny-request": "./node_modules/teeny-request/build/src/index.js",
      "ignore-walk": "./node_modules/ignore-walk/index.js",
      "js-yaml": "./node_modules/js-yaml/index.js",
      "urlgrey": "./node_modules/urlgrey/index.js",
      "argv": "./node_modules/argv/index.js"
    },
    "./node_modules/esquery/": {
      "estraverse": "./node_modules/estraverse/estraverse.js"
    },
    "./node_modules/figures/": {
      "escape-string-regexp": "./node_modules/escape-string-regexp/index.js"
    },
    "./node_modules/find-up/": {
      "locate-path": "./node_modules/locate-path/index.js"
    },
    "./node_modules/hash.js/": {
      "minimalistic-assert": "./node_modules/minimalistic-assert/index.js",
      "inherits": "./node_modules/inherits/inherits.js"
    },
    "./node_modules/is-glob/": {
      "is-extglob": "./node_modules/is-extglob/index.js"
    },
    "./node_modules/js-yaml/": {
      "argparse": "./node_modules/argparse/index.js",
      "esprima": "./node_modules/esprima/dist/esprima.js"
    },
    "./node_modules/levelup/": {
      "deferred-leveldown": "./node_modules/deferred-leveldown/deferred-leveldown.js",
      "readable-stream": "./node_modules/levelup/node_modules/readable-stream/readable.js",
      "semver": "./node_modules/levelup/node_modules/semver/semver.js",
      "errno": "./node_modules/errno/errno.js",
      "xtend": "./node_modules/levelup/node_modules/xtend/index.js",
      "prr": "./node_modules/levelup/node_modules/prr/prr.js",
      "bl": "./node_modules/bl/bl.js"
    },
    "./node_modules/onetime/": {
      "mimic-fn": "./node_modules/mimic-fn/index.js"
    },
    "./node_modules/p-limit/": {
      "p-try": "./node_modules/p-try/index.js"
    },
    "./node_modules/pkg-dir/": {
      "find-up": "./node_modules/find-up/index.js"
    },
    "./node_modules/resolve/": {
      "path-parse": "./node_modules/path-parse/index.js"
    },
    "./node_modules/des.js/": {
      "minimalistic-assert": "./node_modules/minimalistic-assert/index.js",
      "inherits": "./node_modules/inherits/inherits.js"
    },
    "./node_modules/eslint/": {
      "json-stable-stringify-without-jsonify": "./node_modules/json-stable-stringify-without-jsonify/index.js",
      "functional-red-black-tree": "./node_modules/functional-red-black-tree/rbtree.js",
      "eslint-visitor-keys": "./node_modules/eslint-visitor-keys/lib/index.js",
      "strip-json-comments": "./node_modules/strip-json-comments/index.js",
      "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
      "file-entry-cache": "./node_modules/file-entry-cache/cache.js",
      "v8-compile-cache": "./node_modules/v8-compile-cache/v8-compile-cache.js",
      "natural-compare": "./node_modules/natural-compare/index.js",
      "eslint-scope": "./node_modules/eslint/node_modules/eslint-scope/lib/index.js",
      "eslint-utils": "./node_modules/eslint-utils/index.mjs",
      "import-fresh": "./node_modules/import-fresh/index.js",
      "cross-spawn": "./node_modules/cross-spawn/index.js",
      "glob-parent": "./node_modules/glob-parent/index.js",
      "imurmurhash": "./node_modules/imurmurhash/imurmurhash.js",
      "optionator": "./node_modules/optionator/lib/index.js",
      "strip-ansi": "./node_modules/strip-ansi/index.js",
      "text-table": "./node_modules/text-table/index.js",
      "minimatch": "./node_modules/minimatch/minimatch.js",
      "doctrine": "./node_modules/eslint/node_modules/doctrine/lib/doctrine.js",
      "inquirer": "./node_modules/inquirer/lib/inquirer.js",
      "progress": "./node_modules/progress/index.js",
      "esquery": "./node_modules/esquery/esquery.js",
      "esutils": "./node_modules/esutils/lib/utils.js",
      "globals": "./node_modules/globals/index.js",
      "is-glob": "./node_modules/is-glob/index.js",
      "js-yaml": "./node_modules/js-yaml/index.js",
      "regexpp": "./node_modules/regexpp/index.js",
      "espree": "./node_modules/espree/espree.js",
      "ignore": "./node_modules/ignore/index.js",
      "lodash": "./node_modules/lodash/lodash.js",
      "mkdirp": "./node_modules/mkdirp/index.js",
      "semver": "./node_modules/eslint/node_modules/semver/semver.js",
      "chalk": "./node_modules/chalk/index.js",
      "debug": "./node_modules/debug/src/index.js",
      "table": "./node_modules/table/dist/index.js",
      "levn": "./node_modules/levn/lib/index.js",
      "ajv": "./node_modules/ajv/lib/ajv.js"
    },
    "./node_modules/espree/": {
      "eslint-visitor-keys": "./node_modules/eslint-visitor-keys/lib/index.js",
      "acorn-jsx": "./node_modules/acorn-jsx/index.js",
      "acorn": "./node_modules/acorn/dist/acorn.mjs"
    },
    "./node_modules/md5.js/": {
      "safe-buffer": "./node_modules/safe-buffer/index.js",
      "hash-base": "./node_modules/hash-base/index.js",
      "inherits": "./node_modules/inherits/inherits.js"
    },
    "./node_modules/mkdirp/": {
      "minimist": "./node_modules/minimist/index.js"
    },
    "./node_modules/pbkdf2/": {
      "create-hash": "./node_modules/create-hash/index.js",
      "create-hmac": "./node_modules/create-hmac/index.js",
      "safe-buffer": "./node_modules/safe-buffer/index.js",
      "ripemd160": "./node_modules/ripemd160/index.js",
      "sha.js": "./node_modules/sha.js/index.js"
    },
    "./node_modules/rimraf/": {
      "glob": "./node_modules/glob/glob.js"
    },
    "./node_modules/rollup/": {
      "acorn": "./node_modules/rollup/node_modules/acorn/dist/acorn.mjs"
    },
    "./node_modules/sha.js/": {
      "safe-buffer": "./node_modules/safe-buffer/index.js",
      "inherits": "./node_modules/inherits/inherits.js"
    },
    "./node_modules/terser/": {
      "source-map-support": "./node_modules/source-map-support/source-map-support.js",
      "source-map": "./node_modules/terser/node_modules/source-map/source-map.js",
      "commander": "./node_modules/commander/index.js"
    },
    "./node_modules/uri-js/": {
      "punycode": "./node_modules/punycode/punycode.es6.js"
    },
    "./node_modules/chalk/": {
      "escape-string-regexp": "./node_modules/escape-string-regexp/index.js",
      "supports-color": "./node_modules/supports-color/index.js",
      "ansi-styles": "./node_modules/ansi-styles/index.js"
    },
    "./node_modules/debug/": {
      "ms": "./node_modules/ms/index.js"
    },
    "./node_modules/errno/": {
      "prr": "./node_modules/prr/prr.js"
    },
    "./node_modules/json5/": {
      "minimist": "./node_modules/json5/node_modules/minimist/index.js"
    },
    "./node_modules/react/": {
      "object-assign": "./node_modules/object-assign/index.js",
      "loose-envify": "./node_modules/loose-envify/index.js",
      "prop-types": "./node_modules/prop-types/index.js"
    },
    "./node_modules/table/": {
      "string-width": "./node_modules/table/node_modules/string-width/index.js",
      "slice-ansi": "./node_modules/slice-ansi/index.js",
      "lodash": "./node_modules/lodash/lodash.js",
      "ajv": "./node_modules/ajv/lib/ajv.js"
    },
    "./node_modules/which/": {
      "isexe": "./node_modules/isexe/index.js"
    },
    "./node_modules/write/": {
      "mkdirp": "./node_modules/mkdirp/index.js"
    },
    "./node_modules/yauzl/": {
      "fd-slicer": "./node_modules/fd-slicer/index.js"
    },
    "./node_modules/glob/": {
      "path-is-absolute": "./node_modules/path-is-absolute/index.js",
      "fs.realpath": "./node_modules/fs.realpath/index.js",
      "minimatch": "./node_modules/minimatch/minimatch.js",
      "inflight": "./node_modules/inflight/inflight.js",
      "inherits": "./node_modules/inherits/inherits.js",
      "once": "./node_modules/once/once.js"
    },
    "./node_modules/levn/": {
      "prelude-ls": "./node_modules/prelude-ls/lib/index.js",
      "type-check": "./node_modules/type-check/lib/index.js"
    },
    "./node_modules/once/": {
      "wrappy": "./node_modules/wrappy/wrappy.js"
    },
    "./node_modules/rxjs/": {
      "tslib": "./node_modules/tslib/tslib.es6.js"
    },
    "./node_modules/ajv/": {
      "fast-json-stable-stringify": "./node_modules/fast-json-stable-stringify/index.js",
      "json-schema-traverse": "./node_modules/json-schema-traverse/index.js",
      "fast-deep-equal": "./node_modules/fast-deep-equal/index.js",
      "uri-js": "./node_modules/uri-js/dist/es5/uri.all.js"
    },
    "./node_modules/has/": {
      "function-bind": "./node_modules/function-bind/index.js"
    },
    "./node_modules/tmp/": {
      "os-tmpdir": "./node_modules/os-tmpdir/index.js"
    },
    "./node_modules/bl/": {
      "readable-stream": "./node_modules/bl/node_modules/readable-stream/readable.js"
    },
    "./node_modules/ws/": {
      "async-limiter": "./node_modules/async-limiter/index.js"
    }
  }
};

// eslint-disable-next-line import/no-unresolved
var nodeRequire = require;
var filenameContainsBackSlashes = __filename.indexOf("\\") > -1;
var url = filenameContainsBackSlashes ? "file://".concat(__filename.replace(/\\/g, "/")) : "file://".concat(__filename);
var importMapNormalized = normalizeImportMap(importMap, url);

var createCancellationToken = function createCancellationToken() {
  var register = function register(callback) {
    if (typeof callback !== "function") {
      throw new Error("callback must be a function, got ".concat(callback));
    }

    return {
      callback: callback,
      unregister: function unregister() {}
    };
  };

  var throwIfRequested = function throwIfRequested() {
    return undefined;
  };

  return {
    register: register,
    cancellationRequested: false,
    throwIfRequested: throwIfRequested
  };
};

var createOperation = function createOperation(_ref) {
  var _ref$cancellationToke = _ref.cancellationToken,
      cancellationToken = _ref$cancellationToke === void 0 ? createCancellationToken() : _ref$cancellationToke,
      start = _ref.start,
      rest = _objectWithoutProperties(_ref, ["cancellationToken", "start"]);

  ensureExactParameters(rest);
  cancellationToken.throwIfRequested();
  var promise = new Promise(function (resolve) {
    resolve(start());
  });
  var cancelPromise = new Promise(function (resolve, reject) {
    var cancelRegistration = cancellationToken.register(function (cancelError) {
      cancelRegistration.unregister();
      reject(cancelError);
    });
    promise.then(cancelRegistration.unregister, function () {});
  });
  var operationPromise = Promise.race([promise, cancelPromise]);
  return operationPromise;
};

var ensureExactParameters = function ensureExactParameters(extraParameters) {
  var extraParamNames = Object.keys(extraParameters);
  if (extraParamNames.length) throw new Error("createOperation expect only cancellationToken, start. Got ".concat(extraParamNames));
};

function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }

  if (!value || !value.then) {
    value = Promise.resolve(value);
  }

  return then ? value.then(then) : value;
}

var fetch = nodeRequire("node-fetch");

function _invoke(body, then) {
  var result = body();

  if (result && result.then) {
    return result.then(then);
  }

  return then(result);
}

var AbortController = nodeRequire("abort-controller"); // ideally we should only pass this to the fetch below


function _async(f) {
  return function () {
    for (var args = [], i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }

    try {
      return Promise.resolve(f.apply(this, args));
    } catch (e) {
      return Promise.reject(e);
    }
  };
}

https.globalAgent.options.rejectUnauthorized = false;
var fetchUsingHttp = _async(function (url) {
  var _exit = false;

  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var cancellationToken = _ref.cancellationToken,
      rest = _objectWithoutProperties(_ref, ["cancellationToken"]);

  return _invoke(function () {
    if (cancellationToken) {
      // a cancelled fetch will never resolve, while cancellation api
      // expect to get a rejected promise.
      // createOperation ensure we'll get a promise rejected with a cancelError
      return _await(createOperation({
        cancellationToken: cancellationToken,
        start: function start() {
          return fetch(url, _objectSpread({
            signal: cancellationTokenToAbortSignal(cancellationToken)
          }, rest));
        }
      }), function (response) {
        _exit = true;
        return normalizeResponse(response);
      });
    }
  }, function (_result) {
    return _exit ? _result : _await(fetch(url, rest), normalizeResponse);
  });
});

var normalizeResponse = _async(function (response) {
  return _await(response.text(), function (text) {
    return {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: responseToHeaderMap(response),
      body: text
    };
  });
}); // https://github.com/bitinn/node-fetch#request-cancellation-with-abortsignal


var cancellationTokenToAbortSignal = function cancellationTokenToAbortSignal(cancellationToken) {
  var abortController = new AbortController();
  cancellationToken.register(function (reason) {
    abortController.abort(reason);
  });
  return abortController.signal;
};

var responseToHeaderMap = function responseToHeaderMap(response) {
  var headerMap = {};
  response.headers.forEach(function (value, name) {
    headerMap[name] = value;
  });
  return headerMap;
};

var createRequireFromFilename = typeof module$1.Module.createRequireFromPath === "function" ? module$1.Module.createRequireFromPath : function (filename) {
  var dirname = pathnameToDirname(filename);
  var moduleObject = new module$1.Module(filename);
  moduleObject.filename = filename;
  moduleObject.paths = module$1.Module._nodeModulePaths(dirname); // https://github.com/nodejs/node/blob/f76ce0a75641991bfc235775a4747c978e0e281b/lib/module.js#L506

  var resolve = function resolve(specifier) {
    return module$1.Module._resolveFilename(specifier, moduleObject);
  };

  var __require = nodeRequire; // eslint-disable-next-line import/no-dynamic-require

  var scopedRequire = function scopedRequire(specifier) {
    return __require(resolve(specifier));
  };

  scopedRequire.main = __require.main;
  scopedRequire.extensions = __require.extensions;
  scopedRequire.cache = __require.cache;
  scopedRequire.resolve = resolve;
  return scopedRequire;
};

function _await$1(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }

  if (!value || !value.then) {
    value = Promise.resolve(value);
  }

  return then ? value.then(then) : value;
}

var FAKE_SERVER_ORIGIN = "http://example.com";

function _async$1(f) {
  return function () {
    for (var args = [], i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }

    try {
      return Promise.resolve(f.apply(this, args));
    } catch (e) {
      return Promise.reject(e);
    }
  };
}

var execute = _async$1(function (_ref) {
  var compileServerOrigin = _ref.compileServerOrigin,
      projectPathname = _ref.projectPathname,
      compileIntoRelativePath = _ref.compileIntoRelativePath,
      fileRelativePath = _ref.fileRelativePath,
      collectNamespace = _ref.collectNamespace,
      collectCoverage = _ref.collectCoverage,
      executionId = _ref.executionId,
      _ref$errorExposureInC = _ref.errorExposureInConsole,
      errorExposureInConsole = _ref$errorExposureInC === void 0 ? false : _ref$errorExposureInC;
  process.once("unhandledRejection", function (valueRejected) {
    throw valueRejected;
  }); // ça ne fixera pas le fait que require se fera ou mauvais endroit

  var executionFilePath = pathnameToOperatingSystemPath("".concat(projectPathname).concat(fileRelativePath)); // process.chdir(executionFilePath)

  var executionRequire = createRequireFromFilename(executionFilePath);

  var _executionRequire = executionRequire("source-map"),
      SourceMapConsumer = _executionRequire.SourceMapConsumer;

  var _executionRequire2 = executionRequire("@jsenv/error-stack-sourcemap"),
      installNodeErrorStackRemapping = _executionRequire2.installNodeErrorStackRemapping;

  return _await$1(fetchUsingHttp("".concat(compileServerOrigin, "/.jsenv/node-platform.js")), function () {
    // eslint-disable-next-line import/no-dynamic-require
    var _require = require(pathnameToOperatingSystemPath("".concat(projectPathname).concat(compileIntoRelativePath, "/.jsenv/node-platform.js"))),
        nodePlatform = _require.nodePlatform;

    var _nodePlatform$create = nodePlatform.create({
      compileServerOrigin: compileServerOrigin,
      projectPathname: projectPathname
    }),
        relativePathToCompiledHref = _nodePlatform$create.relativePathToCompiledHref,
        executeFile = _nodePlatform$create.executeFile;

    var compiledHref = relativePathToCompiledHref(fileRelativePath);

    var _installNodeErrorStac = installNodeErrorStackRemapping({
      resolveHref: function resolveHref(_ref2) {
        var type = _ref2.type,
            specifier = _ref2.specifier,
            importer = _ref2.importer;

        if (type === "source" || type === "file-original" || type === "source-map") {
          var importerServerHref = importer ? pathToServerHref(importer, {
            projectPathname: projectPathname,
            compileServerOrigin: compileServerOrigin
          }) : "".concat(compileServerOrigin).concat(fileRelativePath);
          var specifierHref = resolveUrl(specifier, importerServerHref);
          var specifierOrigin = hrefToOrigin(specifierHref);

          if (specifierOrigin === compileServerOrigin) {
            var pathname = "".concat(projectPathname).concat(hrefToPathname(specifierHref));
            return "file://".concat(pathname);
          }

          if (specifierOrigin === FAKE_SERVER_ORIGIN) {
            var _pathname = hrefToPathname(specifierHref);

            return "file://".concat(_pathname);
          }

          return specifierHref;
        } // C:\\Users\\me\\file.js -> file:///C:/Users/me/file.js


        if (isWindowsPath(specifier)) {
          return "file://".concat(operatingSystemPathToPathname(specifier));
        } // /Users/me/file.js => file:///Users/me/file.js


        if (specifier[0] === "/") {
          return "file://".concat(specifier);
        } // ./foo.js.map -> file:///Users/me/foo.js.map


        if (specifier.slice(0, 2) === "./" || specifier.slice(0, 3) === "../") {
          return resolveUrl(specifier, importer || "file://".concat(projectPathname).concat(hrefToPathname(compiledHref)));
        } // http://, file:/// -> return untouched


        var hasScheme = Boolean(hrefToScheme(specifier));
        if (hasScheme) return specifier; // internal/process.js for instance

        return "file:///".concat(specifier);
      },
      SourceMapConsumer: SourceMapConsumer
    }),
        getErrorOriginalStackString = _installNodeErrorStac.getErrorOriginalStackString;

    return executeFile(compiledHref, {
      collectNamespace: collectNamespace,
      collectCoverage: collectCoverage,
      executionId: executionId,
      errorTransform: _async$1(function (error) {
        return !error || !(error instanceof Error) ? error : _await$1(getErrorOriginalStackString(error), function (originalStack) {
          error.stack = originalStack;
          return error;
        });
      }),
      errorExposureInConsole: errorExposureInConsole
    });
  });
});

var pathToServerHref = function pathToServerHref(path, _ref3) {
  var projectPathname = _ref3.projectPathname,
      compileServerOrigin = _ref3.compileServerOrigin;

  if (isWindowsPath(path)) {
    return pathnameToServerHref(operatingSystemPathToPathname(path), {
      projectPathname: projectPathname,
      compileServerOrigin: compileServerOrigin
    });
  }

  if (path[0] === "/") {
    return pathnameToServerHref(path, {
      projectPathname: projectPathname,
      compileServerOrigin: compileServerOrigin
    });
  }

  if (path.startsWith("file:///")) {
    return pathnameToServerHref(operatingSystemPathToPathname(hrefToPathname(path)), {
      projectPathname: projectPathname,
      compileServerOrigin: compileServerOrigin
    });
  }

  return path;
};

var pathnameToServerHref = function pathnameToServerHref(pathname, _ref4) {
  var projectPathname = _ref4.projectPathname,
      compileServerOrigin = _ref4.compileServerOrigin;
  var isInsideProject = pathnameIsInside(pathname, projectPathname);

  if (isInsideProject) {
    return "".concat(compileServerOrigin).concat(pathnameToRelativePathname(pathname, projectPathname));
  }

  return "".concat(FAKE_SERVER_ORIGIN).concat(pathname);
};

exports.execute = execute;

//# sourceMappingURL=./node-execute-template.js.map