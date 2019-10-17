'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var path = require('path');
var fs = require('fs');
var util = require('util');
var crypto = require('crypto');

// copied from
// https://github.com/babel/babel/blob/0ee2c42b55e1893f0ae6510916405eb273587844/packages/babel-preset-env/data/plugins.json
// Because this is an hidden implementation detail of @babel/preset-env
// it could be deprecated or moved anytime.
// For that reason it makes more sens to have it inlined here
// than importing it from an undocumented location.
// Ideally it would be documented or a separate module
const babelPluginCompatMap = {
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
  const basePathname = hrefToPathname(baseUrl); // pathname relative inside

  if (specifier.slice(0, 2) === "./") {
    const baseDirname = pathnameToDirname(basePathname);
    return `${baseOrigin}${baseDirname}/${specifier.slice(2)}`;
  } // pathname relative outside


  if (specifier.slice(0, 3) === "../") {
    let unresolvedPathname = specifier;
    const importerFolders = basePathname.split("/");
    importerFolders.pop();

    while (unresolvedPathname.slice(0, 3) === "../") {
      // when there is no folder left to resolved
      // we just ignore '../'
      if (importerFolders.length) {
        importerFolders.pop();
      }

      unresolvedPathname = unresolvedPathname.slice(3);
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

const resolveSpecifier = (specifier, importer) => {
  if (specifier[0] === "/" || specifier.startsWith("./") || specifier.startsWith("../")) {
    return resolveUrl(specifier, importer);
  }

  if (hasScheme(specifier)) {
    return specifier;
  }

  return null;
};

// eslint-disable-next-line import/no-unresolved
const nodeRequire = require;
const filenameContainsBackSlashes = __filename.indexOf("\\") > -1;
const url = filenameContainsBackSlashes ? `file://${__filename.replace(/\\/g, "/")}` : `file://${__filename}`;

const pathnameToRelativePath = (pathname, otherPathname) => pathname.slice(otherPathname.length);

const startsWithWindowsDriveLetter = string => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = string[1];
  if (secondChar !== ":") return false;
  return true;
};

const replaceSlashesWithBackSlashes = string => string.replace(/\//g, "\\");

const pathnameToOperatingSystemPath = pathname => {
  if (pathname[0] !== "/") throw new Error(`pathname must start with /, got ${pathname}`);
  const pathnameWithoutLeadingSlash = pathname.slice(1);

  if (startsWithWindowsDriveLetter(pathnameWithoutLeadingSlash) && pathnameWithoutLeadingSlash[2] === "/") {
    return replaceSlashesWithBackSlashes(pathnameWithoutLeadingSlash);
  } // linux mac pathname === operatingSystemFilename


  return pathname;
};

const isWindowsPath = path => startsWithWindowsDriveLetter(path) && path[2] === "\\";

const replaceBackSlashesWithSlashes = string => string.replace(/\\/g, "/");

const operatingSystemPathToPathname = operatingSystemPath => {
  if (isWindowsPath(operatingSystemPath)) {
    return `/${replaceBackSlashesWithSlashes(operatingSystemPath)}`;
  } // linux and mac operatingSystemFilename === pathname


  return operatingSystemPath;
};

const pathnameIsInside = (pathname, otherPathname) => pathname.startsWith(`${otherPathname}/`);

const pathnameToRelativePathname = (pathname, otherPathname) => pathname.slice(otherPathname.length);

if (typeof __filename === "string") {
  exports.jsenvCorePath = path.resolve(__filename, "../../../"); // get ride of dist/commonjs/main.js
} else {
  const selfPathname = hrefToPathname(url);
  const selfPath = pathnameToOperatingSystemPath(selfPathname);
  exports.jsenvCorePath = path.resolve(selfPath, "../../../"); // get ride of src/jsenvCorePath/jsenvCorePath.js
}
const jsenvCorePathname = operatingSystemPathToPathname(exports.jsenvCorePath);

const {
  list
} = nodeRequire("@babel/helpers");

const babelHelperNameInsideJsenvCoreArray = ["applyDecoratedDescriptor", "arrayWithHoles", "arrayWithoutHoles", "assertThisInitialized", "AsyncGenerator", "asyncGeneratorDelegate", "asyncIterator", "asyncToGenerator", "awaitAsyncGenerator", "AwaitValue", "classCallCheck", "classNameTDZError", "classPrivateFieldDestructureSet", "classPrivateFieldGet", "classPrivateFieldLooseBase", "classPrivateFieldLooseKey", "classPrivateFieldSet", "classPrivateMethodGet", "classPrivateMethodSet", "classStaticPrivateFieldSpecGet", "classStaticPrivateFieldSpecSet", "classStaticPrivateMethodGet", "classStaticPrivateMethodSet", "construct", "createClass", "decorate", "defaults", "defineEnumerableProperties", "defineProperty", "extends", "get", "getPrototypeOf", "inherits", "inheritsLoose", "initializerDefineProperty", "initializerWarningHelper", "instanceof", "interopRequireDefault", "interopRequireWildcard", "isNativeFunction", "iterableToArray", "iterableToArrayLimit", "iterableToArrayLimitLoose", "jsx", "newArrowCheck", "nonIterableRest", "nonIterableSpread", "objectDestructuringEmpty", "objectSpread", "objectSpread2", "objectWithoutProperties", "objectWithoutPropertiesLoose", "possibleConstructorReturn", "readOnlyError", "set", "setPrototypeOf", "skipFirstGeneratorNext", "slicedToArray", "slicedToArrayLoose", "superPropBase", "taggedTemplateLiteral", "taggedTemplateLiteralLoose", "tdz", "temporalRef", "temporalUndefined", "toArray", "toConsumableArray", "toPrimitive", "toPropertyKey", "typeof", "wrapAsyncGenerator", "wrapNativeSuper", "wrapRegExp"];
const babelHelperMap = {};
list.forEach(babelHelperName => {
  if (babelHelperNameInsideJsenvCoreArray.includes(babelHelperName)) {
    babelHelperMap[babelHelperName] = `@jsenv/core/helpers/babel/${babelHelperName}/${babelHelperName}.js`;
  } else {
    babelHelperMap[babelHelperName] = `file://${jsenvCorePathname}/.babel-helpers/${babelHelperName}.js`;
  }
});

// https://www.statista.com/statistics/268299/most-popular-internet-browsers/
// this source of stat is what I found in 5min
// we could improve these default usage score using better stats
// and keep in mind this should be updated time to time or even better
// come from a project specific audience
const browserScoreMap = {
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

const arrayWithout = (array, predicate) => {
  const outputArray = [];
  let i = 0;

  while (i < array.length) {
    const value = array[i];
    const index = i;
    i++;
    if (predicate(value, index, outputArray)) continue;
    outputArray.push(value);
  }

  return outputArray;
};

const arrayWithoutValue = (array, valueToRemove) => arrayWithout(array, value => value === valueToRemove);

const promiseSequence = async callbackArray => {
  const values = [];

  const visit = async index => {
    if (index === callbackArray.length) return;
    const callback = callbackArray[index];
    const value = await callback();
    values.push(value);
    await visit(index + 1);
  };

  await visit(0);
  return values;
};

// export const ensureFolderLeadingTo = (file) => {
//   return new Promise((resolve, reject) => {
//     fs.mkdir(path.dirname(file), { resurcive: true }, (error) => {
//       if (error) {
//         if (error.code === "EEXIST") {
//           resolve()
//           return
//         }
//         reject(error)
//         return
//       }
//       resolve()
//     })
//   })
// }

const fileMakeDirname = file => {
  const fileNormalized = normalizeSeparation(file); // remove first / in case path starts with / (linux)
  // because it would create a "" entry in folders array below
  // tryig to create a folder at ""

  const fileStartsWithSlash = fileNormalized[0] === "/";
  const pathname = fileStartsWithSlash ? fileNormalized.slice(1) : fileNormalized;
  const folders = pathname.split("/");
  folders.pop();
  return promiseSequence(folders.map((_, index) => {
    return () => {
      const folder = folders.slice(0, index + 1).join("/");
      return folderMake(`${fileStartsWithSlash ? "/" : ""}${folder}`);
    };
  }));
};

const normalizeSeparation = file => file.replace(/\\/g, "/");

const folderMake = folder => new Promise((resolve, reject) => {
  fs.mkdir(folder, async error => {
    if (error) {
      // au cas ou deux script essayent de crée un dossier peu importe qui y arrive c'est ok
      if (error.code === "EEXIST") {
        const stat = await fileLastStat(folder);

        if (stat.isDirectory()) {
          resolve();
        } else {
          reject({
            status: 500,
            reason: "expect a directory"
          });
        }
      } else {
        reject({
          status: 500,
          reason: error.code
        });
      }
    } else {
      resolve();
    }
  });
});

const fileLastStat = path => new Promise((resolve, reject) => {
  fs.lstat(path, (error, lstat) => {
    if (error) {
      reject({
        status: 500,
        reason: error.code
      });
    } else {
      resolve(lstat);
    }
  });
});

const copyFilePromisified = util.promisify(fs.copyFile);

const readFilePromisified = util.promisify(fs.readFile);
const fileRead = async file => {
  const buffer = await readFilePromisified(file);
  return buffer.toString();
};

const statPromisified = util.promisify(fs.stat);
const fileStat = async file => {
  const stat = await statPromisified(file);
  return stat;
};

const lstatPromisified = util.promisify(fs.lstat);

const writeFilePromisified = util.promisify(fs.writeFile);
const fileWrite = async (file, content) => {
  await fileMakeDirname(file);
  return writeFilePromisified(file, content);
};

const readdirPromisified = util.promisify(fs.readdir);

const readCompileCacheFolderMeta = async ({
  projectPathname,
  compileCacheFolderRelativePath
}) => {
  try {
    const compileCacheFolderMetaFilePath = pathnameToOperatingSystemPath(`${projectPathname}${compileCacheFolderRelativePath}/meta.json`);
    const source = await fileRead(compileCacheFolderMetaFilePath);
    return JSON.parse(source);
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return null;
    }

    throw e;
  }
};

const writeCompileCacheFolderMeta = async ({
  projectPathname,
  compileCacheFolderRelativePath,
  compileCacheFolderMeta
}) => {
  const cacheMetaMetaFilePath = pathnameToOperatingSystemPath(`${projectPathname}${compileCacheFolderRelativePath}/meta.json`);
  await fileWrite(cacheMetaMetaFilePath, JSON.stringify(compileCacheFolderMeta, null, "  "));
};

const rimraf = nodeRequire("rimraf");

const removeFolder = foldername => new Promise((resolve, reject) => rimraf(foldername, error => {
  if (error) reject(error);else resolve();
}));

const cleanCompileCacheFolderIfObsolete = async ({
  projectPathname,
  compileCacheFolderRelativePath,
  forceObsolete = false,
  cacheMeta,
  cleanCallback = () => {}
}) => {
  const jsenvCorePackagePath = pathnameToOperatingSystemPath(`${jsenvCorePathname}/package.json`);
  const jsenvCorePackageVersion = readPackage(jsenvCorePackagePath).version;
  const compileCacheFolderMeta = { ...cacheMeta,
    jsenvCorePackageVersion
  };
  const cacheFolderPath = pathnameToOperatingSystemPath(`${projectPathname}${compileCacheFolderRelativePath}`);

  if (forceObsolete) {
    cleanCallback(cacheFolderPath);
    await removeFolder(cacheFolderPath);
  } else {
    const previousCompileCacheFolderMeta = await readCompileCacheFolderMeta({
      projectPathname,
      compileCacheFolderRelativePath
    });

    if (JSON.stringify(previousCompileCacheFolderMeta) !== JSON.stringify(compileCacheFolderMeta)) {
      cleanCallback(cacheFolderPath);
      await removeFolder(cacheFolderPath);
    }
  }

  await writeCompileCacheFolderMeta({
    projectPathname,
    compileCacheFolderRelativePath,
    compileCacheFolderMeta
  });
};

const readPackage = packagePath => {
  const buffer = fs.readFileSync(packagePath);
  const string = String(buffer);
  const packageObject = JSON.parse(string);
  return packageObject;
};

const compilationResultToTransformResult = ({
  compiledSource,
  assets,
  assetsContent
}) => {
  const code = compiledSource;
  const sourceMapAssetIndex = assets.findIndex(asset => asset.endsWith(".map"));
  const map = sourceMapAssetIndex === -1 ? undefined : JSON.parse(assetsContent[sourceMapAssetIndex]);
  return {
    code,
    map
  };
};

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

const computeBabelPluginMapForPlatform = ({
  babelPluginMap,
  babelPluginCompatMap: babelPluginCompatMap$1 = babelPluginCompatMap,
  platformName,
  platformVersion
}) => {
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`);
  }

  if (typeof babelPluginCompatMap$1 !== "object") {
    throw new TypeError(`babelPluginCompatMap must be an object, got ${babelPluginCompatMap$1}`);
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
      platformCompatMap: key in babelPluginCompatMap$1 ? babelPluginCompatMap$1[key] : {}
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

const BEST_ID = "best";
const OTHERWISE_ID = "otherwise";

const computeCompileIdFromGroupId = ({
  groupId,
  groupMap
}) => {
  if (typeof groupId === "undefined") {
    if (OTHERWISE_ID in groupMap) return OTHERWISE_ID;
    const keys = Object.keys(groupMap);
    if (keys.length === 1) return keys[0];
    throw new Error(createUnexpectedGroupIdMessage({
      groupMap
    }));
  }

  if (groupId in groupMap === false) throw new Error(createUnexpectedGroupIdMessage({
    groupId,
    groupMap
  }));
  return groupId;
};

const createUnexpectedGroupIdMessage = ({
  compileId,
  groupMap
}) => `unexpected groupId.
--- expected compiled id ----
${Object.keys(groupMap)}
--- received compile id ---
${compileId}`;

// we could reuse this to get a list of polyfill
// using https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/built-ins.json#L1
// adding a featureNameArray to every group
// and according to that featureNameArray, add these polyfill
// to the generated bundle
const jsenvPluginCompatMap = {};

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

const findAsyncPluginNameInBabelPluginMap = babelPluginMap => {
  if ("transform-async-to-promises" in babelPluginMap) {
    return "transform-async-to-promises";
  }

  if ("transform-async-to-generator" in babelPluginMap) {
    return "transform-async-to-generator";
  }

  return "";
};

const {
  buildExternalHelpers
} = nodeRequire("@babel/core");

const {
  getDependencies
} = nodeRequire("@babel/helpers");

const generateBabelHelper = name => {
  const helpersToBuild = [name];
  /**
   * we have to ensure we generate helper dependencies too because
   * some helper contains import like
   * import "setPrototypeOf"
   * and babel deletes them somehow during buildExternalHelpers
   *
   * To fix that we could for instance extract babel helpers into
   * actual files like we already do for global-this
   * or regenerator-runtime
   *
   * But it means every babel update means updating thoose files too.
   * for now let's keep it like that
   */

  const ensureDependencies = name => {
    const dependencies = getDependencies(name);
    dependencies.forEach(name => {
      if (helpersToBuild.includes(name)) {
        return;
      }

      helpersToBuild.push(name);
      ensureDependencies(name);
    });
  };

  ensureDependencies(name);
  return buildExternalHelpers(helpersToBuild, "module");
};

const groupHaveSameRequirements = (leftGroup, rightGroup) => {
  return leftGroup.babelPluginRequiredNameArray.join("") === rightGroup.babelPluginRequiredNameArray.join("") && leftGroup.jsenvPluginRequiredNameArray.join("") === rightGroup.jsenvPluginRequiredNameArray.join("");
};

const generatePlatformGroupArray = ({
  babelPluginMap,
  jsenvPluginMap,
  babelPluginCompatMap: babelPluginCompatMap$1 = babelPluginCompatMap,
  jsenvPluginCompatMap: jsenvPluginCompatMap$1 = jsenvPluginCompatMap,
  platformName
}) => {
  const versionArray = [];
  Object.keys(babelPluginMap).forEach(babelPluginKey => {
    if (babelPluginKey in babelPluginCompatMap$1) {
      const babelPluginCompat = babelPluginCompatMap$1[babelPluginKey];

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
      babelPluginCompatMap: babelPluginCompatMap$1,
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
      [OTHERWISE_ID]: groupWithoutFeature
    };
  }

  const allPlatformGroupArray = generateAllPlatformGroupArray({
    babelPluginMap,
    babelPluginCompatMap,
    jsenvPluginMap,
    jsenvPluginCompatMap,
    platformNames: arrayWithoutValue$1(Object.keys(platformScoreMap), "other")
  });

  if (allPlatformGroupArray.length === 0) {
    return {
      [OTHERWISE_ID]: groupWithoutFeature
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
      [BEST_ID]: allPlatformGroupArraySortedByScore[length - 1]
    };
  }

  const addOtherwiseToBeSafe = !platformAlwaysInsidePlatformScoreMap || !platformWillAlwaysBeKnown;
  const lastGroupIndex = addOtherwiseToBeSafe ? groupCount - 1 : groupCount;
  const groupArray = length + 1 > groupCount ? allPlatformGroupArraySortedByScore.slice(0, lastGroupIndex) : allPlatformGroupArraySortedByScore;
  const groupMap = {};
  groupArray.forEach((group, index) => {
    if (index === 0) {
      groupMap[BEST_ID] = group;
    } else {
      groupMap[`intermediate-${index + 1}`] = group;
    }
  });

  if (addOtherwiseToBeSafe) {
    groupMap[OTHERWISE_ID] = groupWithoutFeature;
  }

  return groupMap;
};

const arrayWithoutValue$1 = (array, value) => array.filter(valueCandidate => valueCandidate !== value);

const LOG_LEVEL_TRACE = "trace";
const LOG_LEVEL_INFO = "info";
const LOG_LEVEL_WARN = "warn";
const LOG_LEVEL_ERROR = "error";
const LOG_LEVEL_OFF = "off";

const createLogger = ({
  logLevel = LOG_LEVEL_INFO
} = {}) => {
  if (logLevel === LOG_LEVEL_TRACE) {
    return {
      trace,
      info,
      warn,
      error
    };
  }

  if (logLevel === LOG_LEVEL_INFO) {
    return {
      trace: traceDisabled,
      info,
      warn,
      error
    };
  }

  if (logLevel === LOG_LEVEL_WARN) {
    return {
      trace: traceDisabled,
      info: infoDisabled,
      warn,
      error
    };
  }

  if (logLevel === LOG_LEVEL_ERROR) {
    return {
      trace: traceDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error
    };
  }

  if (logLevel === LOG_LEVEL_OFF) {
    return {
      trace: traceDisabled,
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
${LOG_LEVEL_TRACE}
`;

const trace = console.trace;

const traceDisabled = () => {};

const info = console.info;

const infoDisabled = () => {};

const warn = console.warn;

const warnDisabled = () => {};

const error = console.error;

const errorDisabled = () => {};

const getCacheFilePath = ({
  projectPathname,
  compileCacheFolderRelativePath,
  compileRelativePath
}) => pathnameToOperatingSystemPath(`${projectPathname}${compileCacheFolderRelativePath}${compileRelativePath}__asset__/cache.json`); // the fact an asset filename is relative to projectPath + compiledpathnameRelative
// is strange considering a source filename is relative to projectPath
// I think it would make more sense to make them relative to the cache.json
// file itself but that's for later

const getAssetFilePath = ({
  projectPathname,
  compileCacheFolderRelativePath,
  compileRelativePath,
  asset
}) => pathnameToOperatingSystemPath(`${projectPathname}${compileCacheFolderRelativePath}/${pathnameToDirname(compileRelativePath.slice(1))}/${asset}`);
const getCompiledFilePath = ({
  projectPathname,
  compileCacheFolderRelativePath,
  compileRelativePath
}) => pathnameToOperatingSystemPath(`${projectPathname}${compileCacheFolderRelativePath}${compileRelativePath}`);
const getSourceFilePath = ({
  projectPathname,
  sourceRelativePath
}) => pathnameToOperatingSystemPath(`${projectPathname}${sourceRelativePath}`);

const readCache = async ({
  projectPathname,
  compileCacheFolderRelativePath,
  sourceRelativePath,
  compileRelativePath,
  logger
}) => {
  const cacheFilePath = getCacheFilePath({
    projectPathname,
    compileCacheFolderRelativePath,
    compileRelativePath
  });

  try {
    const cacheAsString = await fileRead(cacheFilePath);
    const cache = JSON.parse(cacheAsString);
    const sourceRelativePathInCache = cache.sourceRelativePath;

    if (sourceRelativePathInCache !== sourceRelativePath) {
      logger.info(createSourceRelativePathChangedMessage({
        sourceRelativePathInCache,
        sourceRelativePath,
        cacheFilePath
      }));
      return null;
    }

    return cache;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    if (error && error.name === "SyntaxError") {
      logger.error(createCacheSyntaxErrorMessage({
        syntaxError: error,
        cacheFilePath
      }));
      return null;
    }

    throw error;
  }
};

const createSourceRelativePathChangedMessage = ({
  sourceRelativePathInCache,
  sourceRelativePath,
  cacheFilePath
}) => `cache.sourceRelativePath changed
--- sourceRelativePath in cache ---
${sourceRelativePathInCache}
--- sourceRelativePath ---
${sourceRelativePath}
--- cache path ---
${cacheFilePath}`;

const createCacheSyntaxErrorMessage = ({
  syntaxError,
  cacheFilePath
}) => `cache syntax error
--- syntax error stack ---
${syntaxError.stack}
--- cache path ---
${cacheFilePath}`;

const dateToSecondsPrecision = date => {
  const dateWithSecondsPrecision = new Date(date);
  dateWithSecondsPrecision.setMilliseconds(0);
  return dateWithSecondsPrecision;
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

const validateCache = async ({
  projectPathname,
  compileCacheFolderRelativePath,
  compileRelativePath,
  cache,
  ifEtagMatch,
  ifModifiedSinceDate,
  logger
}) => {
  const compiledFileValidation = await validateCompiledFile({
    projectPathname,
    compileCacheFolderRelativePath,
    compileRelativePath,
    ifEtagMatch,
    ifModifiedSinceDate,
    logger
  });
  if (!compiledFileValidation.valid) return compiledFileValidation;
  const [sourcesValidations, assetValidations] = await Promise.all([validateSources({
    projectPathname,
    cache,
    logger
  }), validateAssets({
    projectPathname,
    compileCacheFolderRelativePath,
    compileRelativePath,
    cache,
    logger
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
  projectPathname,
  compileCacheFolderRelativePath,
  compileRelativePath,
  ifEtagMatch,
  ifModifiedSinceDate,
  logger
}) => {
  const compiledFilename = getCompiledFilePath({
    projectPathname,
    compileCacheFolderRelativePath,
    compileRelativePath
  });

  try {
    const compiledSource = await fileRead(compiledFilename);

    if (ifEtagMatch) {
      const compiledEtag = bufferToEtag(Buffer.from(compiledSource));

      if (ifEtagMatch !== compiledEtag) {
        logger.info(`etag changed for ${compiledFilename}`);
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
      const compiledMtime = await fileStat(compiledFilename);

      if (ifModifiedSinceDate < dateToSecondsPrecision(compiledMtime)) {
        logger.info(`mtime changed for ${compiledFilename}`);
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
      return {
        code: "COMPILED_FILE_NOT_FOUND",
        valid: false,
        data: {
          compiledFilename
        }
      };
    }

    return Promise.reject(error);
  }
};

const validateSources = ({
  projectPathname,
  cache,
  logger
}) => Promise.all(cache.sources.map((source, index) => validateSource({
  projectPathname,
  source,
  eTag: cache.sourcesEtag[index],
  logger
})));

const validateSource = async ({
  projectPathname,
  source,
  eTag,
  logger
}) => {
  const sourceFilename = pathnameToOperatingSystemPath(`${projectPathname}${source}`);

  try {
    const sourceContent = await fileRead(sourceFilename);
    const sourceETag = bufferToEtag(Buffer.from(sourceContent));

    if (sourceETag !== eTag) {
      logger.info(`etag changed for ${sourceFilename}`);
      return {
        code: "SOURCE_ETAG_MISMATCH",
        valid: false,
        data: {
          source,
          sourceFilename,
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
      // TODO: decide if it should invalidate cache or not
      // I think if the source cannot be found it does not invalidate the cache
      // it means something is missing to absolutely sure the cache is valid
      // but does not necessarily means the cache is invalid
      // but if we allow source file not found
      // it means we must remove sources from the list of sources
      // or at least consider as normal that it's missing
      // in that case, inside updateCache we must not search for sources that
      // are missing, nor put their etag
      // or we could return sourceContent: '', and the etag would be empty
      logger.info(`source not found at ${sourceFilename}`);
      return {
        code: "SOURCE_NOT_FOUND",
        valid: true,
        data: {
          source,
          sourceFilename,
          sourceContent: ""
        }
      };
    }

    throw e;
  }
};

const validateAssets = ({
  projectPathname,
  compileCacheFolderRelativePath,
  compileRelativePath,
  cache,
  logger
}) => Promise.all(cache.assets.map((asset, index) => validateAsset({
  projectPathname,
  compileCacheFolderRelativePath,
  compileRelativePath,
  asset,
  eTag: cache.assetsEtag[index],
  logger
})));

const validateAsset = async ({
  projectPathname,
  compileCacheFolderRelativePath,
  compileRelativePath,
  asset,
  eTag,
  logger
}) => {
  const assetFilename = getAssetFilePath({
    projectPathname,
    compileCacheFolderRelativePath,
    compileRelativePath,
    asset
  });

  try {
    const assetContent = await fileRead(assetFilename);
    const assetContentETag = bufferToEtag(Buffer.from(assetContent));

    if (eTag !== assetContentETag) {
      logger.info(`etag changed for ${assetFilename}`);
      return {
        code: "ASSET_ETAG_MISMATCH",
        valid: false,
        data: {
          asset,
          assetFilename,
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
      logger.info(`asset not found at ${assetFilename}`);
      return {
        code: "ASSET_FILE_NOT_FOUND",
        valid: false,
        data: {
          asset,
          assetFilename
        }
      };
    }

    return Promise.reject(error);
  }
};

const updateCache = ({
  projectPathname,
  compileCacheFolderRelativePath,
  sourceRelativePath,
  compileRelativePath,
  cacheHitTracking,
  cache,
  compileResult,
  compileResultStatus,
  logger
}) => {
  const isNew = compileResultStatus === "created";
  const isUpdated = compileResultStatus === "updated";
  const isCached = compileResultStatus === "cached";
  const {
    compiledSource,
    contentType,
    sources,
    sourcesContent,
    assets,
    assetsContent
  } = compileResult;
  const promises = [];

  if (isNew || isUpdated) {
    const {
      writeCompiledSourceFile = true,
      writeAssetsFile = true
    } = compileResult;
    const compiledFilePath = getCompiledFilePath({
      projectPathname,
      compileCacheFolderRelativePath,
      compileRelativePath
    });

    if (writeCompiledSourceFile) {
      logger.info(`write file cache at ${compiledFilePath}`);
      promises.push(fileWrite(compiledFilePath, compiledSource));
    }

    if (writeAssetsFile) {
      promises.push(...assets.map((asset, index) => {
        const assetFilePath = getAssetFilePath({
          projectPathname,
          compileCacheFolderRelativePath,
          compileRelativePath,
          asset
        });
        logger.info(`write asset cache at ${assetFilePath}`);
        return fileWrite(assetFilePath, assetsContent[index]);
      }));
    }
  }

  if (isNew || isUpdated || isCached && cacheHitTracking) {
    if (isNew) {
      cache = {
        sourceRelativePath,
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
      cache = { ...cache,
        sources,
        sourcesEtag: sourcesContent.map(sourceContent => bufferToEtag(Buffer.from(sourceContent))),
        assets,
        assetsEtag: assetsContent.map(assetContent => bufferToEtag(Buffer.from(assetContent))),
        lastModifiedMs: Number(Date.now()),
        ...(cacheHitTracking ? {
          matchCount: cache.matchCount + 1,
          lastMatchMs: Number(Date.now())
        } : {})
      };
    } else {
      cache = { ...cache,
        ...(cacheHitTracking ? {
          matchCount: cache.matchCount + 1,
          lastMatchMs: Number(Date.now())
        } : {})
      };
    }

    const cacheFilePath = getCacheFilePath({
      projectPathname,
      compileCacheFolderRelativePath,
      compileRelativePath
    });
    logger.info(`write cache at ${cacheFilePath}`);
    promises.push(fileWrite(cacheFilePath, JSON.stringify(cache, null, "  ")));
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
      lockArray = arrayWithoutValue(lockArray, lock);
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
  projectPathname,
  compileCacheFolderRelativePath,
  sourceRelativePath,
  compileRelativePath = sourceRelativePath,
  compile,
  cacheIgnored = false,
  cacheHitTracking = false,
  cacheInterProcessLocking = false,
  ifEtagMatch,
  ifModifiedSinceDate,
  logLevel = "warn"
}) => {
  if (typeof projectPathname !== "string") {
    throw new TypeError(`projectPathname must be a string, got ${projectPathname}`);
  }

  if (typeof compileCacheFolderRelativePath !== "string") {
    throw new TypeError(`compileCacheFolderRelativePath must be a string, got ${compileCacheFolderRelativePath}`);
  }

  if (typeof sourceRelativePath !== "string") {
    throw new TypeError(`sourceRelativePath must be a string, got ${sourceRelativePath}`);
  }

  if (typeof compileRelativePath !== "string") {
    throw new TypeError(`compileRelativePath must be a string, got ${compileRelativePath}`);
  }

  if (typeof compile !== "function") {
    throw new TypeError(`compile must be a function, got ${compile}`);
  }

  const logger = createLogger({
    logLevel
  });
  return startAsap(async () => {
    const {
      cache,
      compileResult,
      compileResultStatus
    } = await computeCompileReport({
      projectPathname,
      compileCacheFolderRelativePath,
      sourceRelativePath,
      compileRelativePath,
      compile,
      ifEtagMatch,
      ifModifiedSinceDate,
      cacheIgnored,
      logger
    }); // useless because missing source cannot invalidate cache
    // see validateSource in validateCache.js
    // some sources might not exists on the filesystem
    // keep them in the sourcemap
    // however do not mark them as dependency of the compiled version
    // const sources = []
    // const sourcesContent = []
    // await Promise.all(
    //   compileResult.sources.map(async (source, index) => {
    //     const path = pathnameToOperatingSystemPath(`${projectPathname}${source}`)
    //     const pathLeadsToFile = await new Promise((resolve) => {
    //       stat(path, (error, stats) => {
    //         if (error) {
    //           resolve(false)
    //         } else {
    //           resolve(stats.isFile())
    //         }
    //       })
    //     })
    //     if (pathLeadsToFile) {
    //       sources[index] = source
    //       sourcesContent[index] = compileResult.sourcesContent[index]
    //     }
    //   }),
    // )
    // const compileResultWithoutMissingSource = {
    //   ...compileResult,
    //   sources: sources.filter((source) => source !== undefined),
    //   sourcesContent: sourcesContent.filter((sourceContent) => sourceContent !== undefined),
    // }

    await updateCache({
      projectPathname,
      compileCacheFolderRelativePath,
      sourceRelativePath,
      compileRelativePath,
      cacheHitTracking,
      cache,
      compileResult,
      compileResultStatus,
      logger
    });
    return {
      cache,
      compileResult,
      compileResultStatus
    };
  }, {
    projectPathname,
    compileCacheFolderRelativePath,
    compileRelativePath,
    cacheInterProcessLocking,
    logger
  });
};

const computeCompileReport = async ({
  projectPathname,
  compileCacheFolderRelativePath,
  sourceRelativePath,
  compileRelativePath,
  compile,
  ifEtagMatch,
  ifModifiedSinceDate,
  cacheIgnored,
  logger
}) => {
  const cache = cacheIgnored ? null : await readCache({
    projectPathname,
    compileCacheFolderRelativePath,
    sourceRelativePath,
    compileRelativePath,
    logger
  });

  if (!cache) {
    const compileResult = await callCompile({
      projectPathname,
      compileCacheFolderRelativePath,
      sourceRelativePath,
      compileRelativePath,
      compile,
      logger
    });
    return {
      cache: null,
      compileResult,
      compileResultStatus: "created"
    };
  }

  const cacheValidation = await validateCache({
    projectPathname,
    compileCacheFolderRelativePath,
    compileRelativePath,
    cache,
    ifEtagMatch,
    ifModifiedSinceDate,
    logger
  });

  if (!cacheValidation.valid) {
    const compileResult = await callCompile({
      projectPathname,
      compileCacheFolderRelativePath,
      sourceRelativePath,
      compileRelativePath,
      compile,
      logger
    });
    return {
      cache,
      compileResult,
      compileResultStatus: "updated"
    };
  }

  const {
    contentType,
    sources,
    assets
  } = cache;
  const {
    compiledSource,
    sourcesContent,
    assetsContent
  } = cacheValidation.data;
  return {
    cache,
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
  projectPathname,
  compileCacheFolderRelativePath,
  sourceRelativePath,
  compileRelativePath,
  compile,
  logger
}) => {
  const sourceFilename = getSourceFilePath({
    projectPathname,
    sourceRelativePath
  });
  const compiledFilename = getCompiledFilePath({
    projectPathname,
    compileCacheFolderRelativePath,
    compileRelativePath
  });
  logger.info(`compile ${sourceRelativePath}`);
  const {
    sources = [],
    sourcesContent = [],
    assets = [],
    assetsContent = [],
    contentType,
    compiledSource,
    ...rest
  } = await compile({
    sourceRelativePath,
    compileRelativePath,
    sourceFilename,
    compiledFilename
  });
  if (typeof contentType !== "string") throw new TypeError(`compile must return a contentType string, got ${contentType}`);
  if (typeof compiledSource !== "string") throw new TypeError(`compile must return a compiledSource string, got ${compiledSource}`);
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
  projectPathname,
  compileCacheFolderRelativePath,
  compileRelativePath,
  cacheInterProcessLocking,
  logger
}) => {
  const cacheFilePath = getCacheFilePath({
    projectPathname,
    compileCacheFolderRelativePath,
    compileRelativePath
  });
  logger.info(`lock ${cacheFilePath}`); // in case this process try to concurrently access meta we wait for previous to be done

  const unlockLocal = await lockForRessource(cacheFilePath);

  let unlockInterProcessLock = () => {};

  if (cacheInterProcessLocking) {
    // after that we use a lock pathnameRelative to be sure we don't conflict with other process
    // trying to do the same (mapy happen when spawining multiple server for instance)
    // https://github.com/moxystudio/node-proper-lockfile/issues/69
    await fileMakeDirname(cacheFilePath); // https://github.com/moxystudio/node-proper-lockfile#lockfile-options

    unlockInterProcessLock = await lockfile.lock(cacheFilePath, {
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
    unlockLocal();
    unlockInterProcessLock();
    logger.info(`unlock ${cacheFilePath}`);
  } // here in case of error.code === 'ELOCKED' thrown from here
  // https://github.com/moxystudio/node-proper-lockfile/blob/1a478a43a077a7a7efc46ac79fd8f713a64fd499/lib/lockfile.js#L54
  // we could give a better failure message when server tries to compile a file
  // otherwise he'll get a 500 without much more info to debug
  // we use two lock because the local lock is very fast, it's a sort of perf improvement

};

// https://nodejs.org/metrics/summaries/version/nodejs.org-access.log.csv
const nodeVersionScoreMap = {
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

const readProjectImportMap = async ({
  projectPathname,
  jsenvProjectPathname,
  importMapRelativePath,
  logger
}) => {
  if (typeof projectPathname !== "string") {
    throw new TypeError(`projectPathname must be a string, got ${projectPathname}`);
  }

  if (typeof jsenvProjectPathname !== "string") {
    throw new TypeError(`jsenvProjectPathname must be a string, got ${jsenvProjectPathname}`);
  }

  const importMapForProject = await getProjectImportMap({
    projectPathname,
    importMapRelativePath
  });
  const jsenvCoreImportKey = "@jsenv/core/";
  const jsenvCoreImportValue = `${pathnameToRelativePath(jsenvCorePathname, projectPathname)}/`;
  const importsForJsenvCore = {
    [jsenvCoreImportKey]: jsenvCoreImportValue
  };

  if (!importMapForProject) {
    return {
      imports: importsForJsenvCore
    };
  }

  if (importMapForProject.imports) {
    const jsenvCoreProjectImportValue = importMapForProject.imports[jsenvCoreImportKey];

    if (jsenvCoreProjectImportValue && jsenvCoreProjectImportValue !== jsenvCoreImportValue) {
      logger.warn(createIncompatibleJsenvCoreDependencyMessage({
        projectPathname,
        jsenvProjectPathname,
        jsenvCoreProjectRelativePath: jsenvCoreProjectImportValue.slice(0, -1),
        jsenvCoreRelativePath: jsenvCoreImportValue.slice(0, -1)
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
  projectPathname,
  importMapRelativePath
}) => {
  if (!importMapRelativePath) {
    return null;
  }

  const importMapPath = pathnameToOperatingSystemPath(`${projectPathname}/${importMapRelativePath}`);
  return new Promise((resolve, reject) => {
    fs.readFile(importMapPath, (error, buffer) => {
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
  projectPathname,
  jsenvProjectPathname,
  jsenvCoreProjectRelativePath,
  jsenvCoreRelativePath
}) => `incompatible dependency to @jsenv/core in your project and an internal jsenv project.
To fix this either remove project dependency to @jsenv/core or ensure they use the same version.
--- jsenv project wanted relative path to @jsenv/core ---
${jsenvCoreRelativePath}
--- your project relative path to @jsenv/core ---
${jsenvCoreProjectRelativePath}
--- jsenv project path ---
${jsenvProjectPathname}
--- your project path ---
${projectPathname}`;

const resolveGroup = ({
  name,
  version
}, {
  groupMap
}) => {
  return Object.keys(groupMap).find(compileIdCandidate => {
    const {
      platformCompatMap
    } = groupMap[compileIdCandidate];

    if (name in platformCompatMap === false) {
      return false;
    }

    const versionForGroup = platformCompatMap[name];
    const highestVersion = findHighestVersion(version, versionForGroup);
    return highestVersion === version;
  });
};

const firstMatch = (regexp, string) => {
  const match = string.match(regexp);
  return match && match.length > 0 ? match[1] || undefined : undefined;
};
const secondMatch = (regexp, string) => {
  const match = string.match(regexp);
  return match && match.length > 1 ? match[2] || undefined : undefined;
};
const userAgentToVersion = userAgent => {
  return firstMatch(/version\/(\d+(\.?_?\d+)+)/i, userAgent) || undefined;
};

const detectAndroid = () => navigatorToBrowser(window.navigator);

const navigatorToBrowser = ({
  userAgent,
  appVersion
}) => {
  if (/(android)/i.test(userAgent)) {
    return {
      name: "android",
      version: firstMatch(/Android (\d+(\.?_?\d+)+)/i, appVersion)
    };
  }

  return null;
};

const detectInternetExplorer = () => userAgentToBrowser(window.navigator.userAgent);

const userAgentToBrowser = userAgent => {
  if (/msie|trident/i.test(userAgent)) {
    return {
      name: "ie",
      version: firstMatch(/(?:msie |rv:)(\d+(\.?_?\d+)+)/i, userAgent)
    };
  }

  return null;
};

const detectOpera = () => userAgentToBrowser$1(window.navigator.userAgent);

const userAgentToBrowser$1 = userAgent => {
  // opera below 13
  if (/opera/i.test(userAgent)) {
    return {
      name: "opera",
      version: userAgentToVersion(userAgent) || firstMatch(/(?:opera)[\s/](\d+(\.?_?\d+)+)/i, userAgent)
    };
  } // opera above 13


  if (/opr\/|opios/i.test(userAgent)) {
    return {
      name: "opera",
      version: firstMatch(/(?:opr|opios)[\s/](\S+)/i, userAgent) || userAgentToVersion(userAgent)
    };
  }

  return null;
};

const detectEdge = () => userAgentToBrowser$2(window.navigator.userAgent);

const userAgentToBrowser$2 = userAgent => {
  if (/edg([ea]|ios)/i.test(userAgent)) {
    return {
      name: "edge",
      version: secondMatch(/edg([ea]|ios)\/(\d+(\.?_?\d+)+)/i, userAgent)
    };
  }

  return null;
};

const detectFirefox = () => userAgentToBrowser$3(window.navigator.userAgent);

const userAgentToBrowser$3 = userAgent => {
  if (/firefox|iceweasel|fxios/i.test(userAgent)) {
    return {
      name: "firefox",
      version: firstMatch(/(?:firefox|iceweasel|fxios)[\s/](\d+(\.?_?\d+)+)/i, userAgent)
    };
  }

  return null;
};

const detectChrome = () => userAgentToBrowser$4(window.navigator.userAgent);

const userAgentToBrowser$4 = userAgent => {
  if (/chromium/i.test(userAgent)) {
    return {
      name: "chrome",
      version: firstMatch(/(?:chromium)[\s/](\d+(\.?_?\d+)+)/i, userAgent) || userAgentToVersion(userAgent)
    };
  }

  if (/chrome|crios|crmo/i.test(userAgent)) {
    return {
      name: "chrome",
      version: firstMatch(/(?:chrome|crios|crmo)\/(\d+(\.?_?\d+)+)/i, userAgent)
    };
  }

  return null;
};

const detectSafari = () => userAgentToBrowser$5(window.navigator.userAgent);

const userAgentToBrowser$5 = userAgent => {
  if (/safari|applewebkit/i.test(userAgent)) {
    return {
      name: "safari",
      version: userAgentToVersion(userAgent)
    };
  }

  return null;
};

const detectElectron = () => null; // TODO

const detectIOS = () => navigatorToBrowser$1(window.navigator);

const navigatorToBrowser$1 = ({
  userAgent,
  appVersion
}) => {
  if (/iPhone;/.test(userAgent)) {
    return {
      name: "ios",
      version: firstMatch(/OS (\d+(\.?_?\d+)+)/i, appVersion)
    };
  }

  if (/iPad;/.test(userAgent)) {
    return {
      name: "ios",
      version: firstMatch(/OS (\d+(\.?_?\d+)+)/i, appVersion)
    };
  }

  return null;
};

// https://github.com/Ahmdrza/detect-browser/blob/26254f85cf92795655a983bfd759d85f3de850c6/detect-browser.js#L1

const detectorCompose = detectors => () => {
  let i = 0;

  while (i < detectors.length) {
    const detector = detectors[i];
    i++;
    const result = detector();

    if (result) {
      return result;
    }
  }

  return null;
};

const detector = detectorCompose([detectOpera, detectInternetExplorer, detectEdge, detectFirefox, detectChrome, detectSafari, detectElectron, detectIOS, detectAndroid]);
const detectBrowser = () => {
  const {
    name = "other",
    version = "unknown"
  } = detector() || {};
  return {
    name: normalizeName(name),
    version: normalizeVersion(version)
  };
};

const normalizeName = name => {
  return name.toLowerCase();
};

const normalizeVersion = version => {
  if (version.indexOf(".") > -1) {
    const parts = version.split("."); // remove extraneous .

    return parts.slice(0, 3).join(".");
  }

  if (version.indexOf("_") > -1) {
    const parts = version.split("_"); // remove extraneous _

    return parts.slice(0, 3).join("_");
  }

  return version;
};

const resolveBrowserGroup = ({
  groupMap
}) => resolveGroup(detectBrowser(), {
  groupMap
});

const detectNode = () => {
  return {
    name: "node",
    version: process.version.slice(1)
  };
};

const resolveNodeGroup = ({
  groupMap
}) => resolveGroup(detectNode(), {
  groupMap
});

const resolvePlatformGroup = ({
  groupMap
}) => {
  if (typeof window === "object") return resolveGroup(detectBrowser(), {
    groupMap
  });
  if (typeof process === "object") return resolveGroup(detectNode(), {
    groupMap
  }); // we should certainly throw with unknown platform

  return null;
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

        const filePathname = operatingSystemPathToPathname(file.opts.filename);
        const babelHelperFilePathname = babelHelperMap[name];

        if (filePathname === babelHelperFilePathname) {
          return undefined;
        }

        if (searchPossibleBabelHelperNameInPath(filePathname) === name) {
          return undefined;
        }

        if (cachedHelpers[name]) {
          return cachedHelpers[name];
        }

        const helper = addDefault(file.path, babelHelperFilePathname, {
          nameHint: `_${name}`
        });
        cachedHelpers[name] = helper;
        return helper;
      });
    }
  };
};
const searchPossibleBabelHelperNameInPath = path => {
  const babelPathPart = "@jsenv/core/helpers/babel/";
  const babelPathPartIndex = path.indexOf(babelPathPart);
  if (babelPathPartIndex === -1) return "";
  const after = path.slice(babelPathPartIndex + babelPathPart.length);
  const helperName = after.slice(0, after.indexOf("/"));
  return helperName;
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
  regeneratorRuntimeImportPath,
  remap
}) => {
  // https://babeljs.io/docs/en/options
  const options = {
    filename: inputPath,
    filenameRelative: inputRelativePath ? inputRelativePath.slice(1) : undefined,
    inputSourceMap: inputMap,
    configFile: false,
    babelrc: false,
    // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: remap,
    sourceFileName: inputRelativePath ? inputRelativePath.slice(1) : undefined,
    // https://babeljs.io/docs/en/options#parseropts
    parserOpts: {
      allowAwaitOutsideFunction: allowTopLevelAwait
    }
  };
  const babelHelperName = searchPossibleBabelHelperNameInPath(inputPath); // to prevent typeof circular dependency

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

  babelPluginMap = { ...babelPluginMap,
    "ensure-global-this-import": [ensureGlobalThisImportBabelPlugin],
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
  url
} = {}) => {
  assertUrlLike(specifier, "specifier");
  assertUrlLike(url, "url");
  return applyPatternMatching(specifier, url);
};

const applyPatternMatching = (pattern, string) => {
  let patternIndex = 0;
  let index = 0;
  let remainingPattern = pattern;
  let remainingString = string; // eslint-disable-next-line no-constant-condition

  while (true) {
    //  '' === '' -> pass
    if (remainingPattern === "" && remainingString === "") {
      return pass({
        patternIndex,
        index
      });
    } // '' === value -> fail


    if (remainingPattern === "" && remainingString !== "") {
      return fail({
        patternIndex,
        index
      });
    } // pattern === '' -> pass only if pattern is only **


    if (remainingPattern !== "" && remainingString === "") {
      // pass because pattern is optionnal
      if (remainingPattern === "**") {
        return pass({
          patternIndex,
          index
        });
      } // fail because **/ would expect something like /a
      // and **a would expect something like foo/bar/a


      return fail({
        patternIndex,
        index
      });
    }

    if (remainingPattern.slice(0, "**".length) === "**") {
      patternIndex += `**`.length;
      remainingPattern = remainingPattern.slice(`**`.length);

      if (remainingPattern[0] === "/") {
        patternIndex += "/".length;
        remainingPattern = remainingPattern.slice("/".length);
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
      patternIndex += "*".length;
      remainingPattern = remainingPattern.slice("*".length); // la c'est plus délicat, il faut que remainingString
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
    } // trailing slash on pattern, -> match remaining


    if (remainingPattern === "/" && remainingString.length > 1) {
      return pass({
        patternIndex: patternIndex + 1,
        index: string.length
      });
    }

    patternIndex += 1;
    index += 1;
    remainingPattern = remainingPattern.slice(1);
    remainingString = remainingString.slice(1);
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


    index += matchAttempt.index + 1;
    remainingString = remainingString.slice(matchAttempt.index + 1);

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

const metaMapToSpecifierMetaMap = metaMap => {
  if (!isPlainObject(metaMap)) {
    throw new TypeError(`metaMap must be a plain object, got ${metaMap}`);
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

// "https://domain.com/folder/file.js"
// "file:///folder/file.js"
// "chrome://folder/file.js"
const isAbsoluteSpecifier = specifier => {
  if (isWindowsDriveSpecifier(specifier)) {
    // window drive letter could are not protocol yep
    // something like `C:/folder/file.js`
    // will be considered as a bare import
    return false;
  }

  return /^[a-zA-Z]+:/.test(specifier);
}; // https://url.spec.whatwg.org/#example-start-with-a-widows-drive-letter

const isWindowsDriveSpecifier = specifier => {
  const firstChar = specifier[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = specifier[1];
  if (secondChar !== ":") return false;
  const thirdChar = specifier[2];
  return thirdChar === "/";
};

const resolveAbsoluteSpecifier = specifier => specifier;

const hrefToScheme$1 = href => {
  const colonIndex = href.indexOf(":");
  if (colonIndex === -1) return "";
  return href.slice(0, colonIndex);
};

const isSchemeRelativeSpecifier = specifier => {
  return specifier.slice(0, 2) === "//";
};
const resolveSchemeRelativeSpecifier = (specifier, importer) => {
  return `${hrefToScheme$1(importer)}:${specifier}`;
};

const isOriginRelativeSpecifier = specifier => {
  const firstChar = specifier[0];
  if (firstChar !== "/") return false;
  const secondChar = specifier[1];
  if (secondChar === "/") return false;
  return true;
};
const resolveOriginRelativeSpecifier = (specifier, importer) => {
  const importerOrigin = hrefToOrigin(importer);
  return `${importerOrigin}/${specifier.slice(1)}`;
};

// https://github.com/systemjs/systemjs/blob/master/src/common.js
// "../folder/file.js"

const isPathnameRelativeSpecifier = specifier => {
  if (specifier.slice(0, 2) === "./") return true;
  if (specifier.slice(0, 3) === "../") return true;
  return false;
};
const resolvePathnameRelativeSpecifier = (specifier, importer) => {
  const importerPathname = hrefToPathname(importer); // ./foo.js on /folder/file.js -> /folder/foo.js
  // ./foo/bar.js on /folder/file.js -> /folder/foo/bar.js
  // ./foo.js on /folder/subfolder/file.js -> /folder/subfolder/foo.js

  if (specifier.slice(0, 2) === "./") {
    const importerOrigin = hrefToOrigin(importer);
    const importerDirname = pathnameToDirname(importerPathname);
    return `${importerOrigin}${importerDirname}/${specifier.slice(2)}`;
  } // ../foo/bar.js on /folder/file.js -> /foo/bar.js
  // ../foo/bar.js on /folder/subfolder/file.js -> /folder/foo/bar.js
  // ../../foo/bar.js on /folder/file.js -> /foo/bar.js
  // ../bar.js on / -> /bar.js


  let unresolvedPathname = specifier;
  const importerFolders = importerPathname.split("/");
  importerFolders.pop(); // remove file, it is not a folder

  while (unresolvedPathname.slice(0, 3) === "../") {
    // when there is no folder left to resolved
    // we just ignore '../'
    if (importerFolders.length) {
      importerFolders.pop();
    }

    unresolvedPathname = unresolvedPathname.slice(3);
  }

  const importerOrigin = hrefToOrigin(importer);
  const resolvedPathname = `${importerFolders.join("/")}/${unresolvedPathname}`;
  return `${importerOrigin}${resolvedPathname}`;
};

const resolveBareSpecifier = (specifier, importer) => {
  const importerOrigin = hrefToOrigin(importer);
  return `${importerOrigin}/${specifier}`;
};

// could be useful: https://url.spec.whatwg.org/#url-miscellaneous
const resolveSpecifier$1 = (specifier, importer) => {
  if (isAbsoluteSpecifier(specifier)) {
    return resolveAbsoluteSpecifier(specifier);
  }

  if (!importer) {
    throw new Error(createMissingImporterMessage(specifier, importer));
  }

  if (!isAbsoluteSpecifier(importer)) {
    throw new Error(createAbsoluteImporterRequiredMessage(importer));
  }

  if (isSchemeRelativeSpecifier(specifier)) {
    return resolveSchemeRelativeSpecifier(specifier, importer);
  }

  if (isOriginRelativeSpecifier(specifier)) {
    return resolveOriginRelativeSpecifier(specifier, importer);
  }

  if (isPathnameRelativeSpecifier(specifier)) {
    return resolvePathnameRelativeSpecifier(specifier, importer);
  }

  return resolveBareSpecifier(specifier, importer);
};

const createMissingImporterMessage = (specifier, importer) => `missing importer to resolve relative specifier.
--- specifier ---
${specifier}
--- importer ---
${importer}`;

const createAbsoluteImporterRequiredMessage = importer => `importer must be absolute.
--- importer ---
${importer}`;

const assertSpecifierMetaMap = value => {
  if (!isPlainObject(value)) {
    throw new TypeError(`specifierMetaMap must be a plain object, got ${value}`);
  } // we could ensure it's key/value pair of url like key/object or null values

};

const FAKE_HTTP_ORIGIN_UNLIKELY_TO_COLLIDE = "http://fake_origin_unlikely_to_collide.ext";
const normalizeSpecifierMetaMap = (specifierMetaMap, url, {
  forceHttpResolutionForFile = false
} = {}) => {
  assertSpecifierMetaMap(specifierMetaMap);
  const resolveSpecifierScoped = forceHttpResolutionForFile && url.startsWith("file:///") ? (specifier, url) => {
    const specifierResolvedAgainstHttp = resolveSpecifier$1(specifier, FAKE_HTTP_ORIGIN_UNLIKELY_TO_COLLIDE);

    if (specifierResolvedAgainstHttp.startsWith(`${FAKE_HTTP_ORIGIN_UNLIKELY_TO_COLLIDE}/`)) {
      const specifierPathname = specifierResolvedAgainstHttp.slice(FAKE_HTTP_ORIGIN_UNLIKELY_TO_COLLIDE.length);
      return `${url}${specifierPathname}`;
    }

    return specifierResolvedAgainstHttp;
  } : resolveSpecifier$1;
  const specifierMetaMapNormalized = {};
  Object.keys(specifierMetaMap).forEach(specifier => {
    const specifierResolved = resolveSpecifierScoped(specifier, url);
    specifierMetaMapNormalized[specifierResolved] = specifierMetaMap[specifier];
  });
  return specifierMetaMapNormalized;
};

const urlToMeta = ({
  url,
  specifierMetaMap
} = {}) => {
  assertUrlLike(url);
  assertSpecifierMetaMap(specifierMetaMap);
  return Object.keys(specifierMetaMap).reduce((previousMeta, specifier) => {
    const {
      matched
    } = applySpecifierPatternMatching({
      specifier,
      url
    });
    return matched ? { ...previousMeta,
      ...specifierMetaMap[specifier]
    } : previousMeta;
  }, {});
};

const transformJs = async ({
  projectPathname,
  source,
  sourceHref,
  sourceMap,
  babelPluginMap,
  convertMap = {},
  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,
  transformGenerator = true,
  remap = true
}) => {
  if (typeof projectPathname !== "string") {
    throw new TypeError(`projectPathname must be a string, got ${projectPathname}`);
  }

  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`);
  }

  if (typeof source !== "string") {
    throw new TypeError(`source must be a string, got ${source}`);
  }

  if (typeof sourceHref !== "string") {
    throw new TypeError(`sourceHref must be a string, got ${sourceHref}`);
  }

  const {
    inputCode,
    inputMap
  } = await computeInputCodeAndInputMap({
    source,
    sourceHref,
    sourceMap,
    projectPathname,
    convertMap,
    remap,
    allowTopLevelAwait
  });
  const inputPath = computeInputPath({
    sourceHref,
    projectPathname
  });
  const inputRelativePath = computeInputRelativePath({
    sourceHref,
    projectPathname
  });
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
    remap
  });
};

const computeInputCodeAndInputMap = async ({
  source,
  sourceHref,
  sourceMap,
  projectPathname,
  convertMap,
  remap,
  allowTopLevelAwait
}) => {
  const specifierMetaMap = normalizeSpecifierMetaMap(metaMapToSpecifierMetaMap({
    convert: convertMap
  }), `file://${projectPathname}`, {
    forceHttpResolutionForFile: true
  });
  const {
    convert
  } = urlToMeta({
    url: sourceHref,
    specifierMetaMap
  });

  if (!convert) {
    return {
      inputCode: source,
      inputMap: sourceMap
    };
  }

  if (typeof convert !== "function") {
    throw new TypeError(`convert must be a function, got ${convert}`);
  } // TODO: update @jsenv/commonjs-converter to handle sourceMap when passed


  const conversionResult = await convert({
    projectPathname,
    source,
    sourceHref,
    sourceMap,
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

const computeInputPath = ({
  sourceHref,
  projectPathname
}) => {
  const scenario = computeScenario({
    sourceHref,
    projectPathname
  });

  if (scenario === "remote") {
    return sourceHref;
  }

  return pathnameToOperatingSystemPath(hrefToPathname(sourceHref));
};

const computeInputRelativePath = ({
  sourceHref,
  projectPathname
}) => {
  const scenario = computeScenario({
    sourceHref,
    projectPathname
  });

  if (scenario === "project-file") {
    return pathnameToRelativePathname(hrefToPathname(sourceHref), projectPathname);
  }

  return undefined;
};

const computeScenario = ({
  sourceHref,
  projectPathname
}) => {
  if (!sourceHref.startsWith("file:///")) {
    return "remote";
  }

  const sourcePathname = hrefToPathname(sourceHref);

  if (pathnameIsInside(sourcePathname, projectPathname)) {
    return "project-file";
  }

  return "file";
};

const writeSourceMappingURL = (source, location) => `${source}
${"//#"} sourceMappingURL=${location}`;

const transformResultToCompilationResult = ({
  code,
  map,
  metadata = {}
}, {
  source,
  sourceHref,
  projectPathname,
  remap = true,
  remapMethod = "comment" // 'comment', 'inline'

}) => {
  if (typeof source !== "string") {
    throw new TypeError(`source must be a string, got ${source}`);
  }

  if (typeof sourceHref !== "string") {
    throw new TypeError(`sourceHref must be a string, got ${sourceHref}`);
  }

  if (typeof projectPathname !== "string") {
    throw new TypeError(`projectPathname must be a string, got ${projectPathname}`);
  }

  const sources = [];
  const sourcesContent = [];
  const assets = [];
  const assetsContent = [];
  let output = code;

  if (remap && map) {
    if (map.sources.length === 0) {
      // may happen in somae cases where babel returns a wrong sourcemap
      // there is at least one case where it happens
      // a file with only import './whatever.js' inside
      sources.push(sourceHrefToSourceMapSource({
        sourceHref,
        projectPathname
      }));
      sourcesContent.push(source);
    } else {
      map.sources = map.sources.map(source => resolveSourceMapSource(source, {
        sourceHref,
        projectPathname
      }));
      sources.push(...map.sources);
      if (map.sourcesContent) sourcesContent.push(...map.sourcesContent);
    } // removing sourcesContent from map decrease the sourceMap
    // it also means client have to fetch source from server (additional http request)
    // some client ignore sourcesContent property such as vscode-chrome-debugger
    // Because it's the most complex scenario and we want to ensure client is always able
    // to find source from the sourcemap, we explicitely delete nmap.sourcesContent to test this.


    delete map.sourcesContent; // we don't need sourceRoot because our path are relative or absolute to the current location
    // we could comment this line because it is not set by babel because not passed during transform

    delete map.sourceRoot;

    if (remapMethod === "inline") {
      const mapAsBase64 = new Buffer(JSON.stringify(map)).toString("base64");
      output = writeSourceMappingURL(output, `data:application/json;charset=utf-8;base64,${mapAsBase64}`);
    } else if (remapMethod === "comment") {
      const sourceMapAssetPath = generateAssetPath({
        sourceHref,
        assetName: `${sourceHrefToBasename(sourceHref)}.map`
      });
      output = writeSourceMappingURL(output, `./${sourceMapAssetPath}`);
      assets.push(sourceMapAssetPath);
      assetsContent.push(stringifyMap(map));
    }
  } else {
    sources.push(sourceHrefToSourceMapSource({
      sourceHref,
      projectPathname
    }));
    sourcesContent.push(source);
  }

  const {
    coverage
  } = metadata;

  if (coverage) {
    const coverageAssetPath = generateAssetPath({
      sourceHref,
      assetName: "coverage.json"
    });
    assets.push(coverageAssetPath);
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

const sourceHrefToSourceMapSource = ({
  sourceHref,
  projectPathname
}) => {
  const relativePath = computeInputRelativePath({
    sourceHref,
    projectPathname
  });
  return relativePath || sourceHref;
};

const resolveSourceMapSource = (sourceMapSource, {
  sourceHref,
  projectPathname
}) => {
  if (sourceMapSource[0] === "/") {
    return sourceMapSource;
  }

  if (sourceMapSource.slice(0, 2) === "./" || sourceMapSource.slice(0, 3) === "../") {
    const sourceMapSourceHref = resolveSpecifier(sourceMapSource, sourceHref);
    const sourceMapSourcePathname = hrefToPathname(sourceMapSourceHref);
    return pathnameToRelativePathname(sourceMapSourcePathname, projectPathname);
  }

  if (sourceMapSource.startsWith("file://")) {
    return sourceMapSource;
  }

  if (sourceMapSource.startsWith("http://")) {
    return sourceMapSource;
  }

  if (sourceMapSource.startsWith("https://")) {
    return sourceMapSource;
  }

  return `/${sourceMapSource}`;
};

const generateAssetPath = ({
  sourceHref,
  assetName
}) => {
  return `${sourceHrefToBasename(sourceHref)}__asset__/${assetName}`;
};

const sourceHrefToBasename = sourceHref => path.basename(hrefToPathname(sourceHref));

const stringifyMap = object => JSON.stringify(object, null, "  ");

const stringifyCoverage = object => JSON.stringify(object, null, "  ");

exports.babelHelperMap = babelHelperMap;
exports.babelPluginCompatMap = babelPluginCompatMap;
exports.browserScoreMap = browserScoreMap;
exports.cleanCompileCacheFolderIfObsolete = cleanCompileCacheFolderIfObsolete;
exports.compilationResultToTransformResult = compilationResultToTransformResult;
exports.computeBabelPluginMapForPlatform = computeBabelPluginMapForPlatform;
exports.computeCompileIdFromGroupId = computeCompileIdFromGroupId;
exports.computeJsenvPluginMapForPlatform = computeJsenvPluginMapForPlatform;
exports.findAsyncPluginNameInBabelPluginMap = findAsyncPluginNameInBabelPluginMap;
exports.generateBabelHelper = generateBabelHelper;
exports.generateGroupMap = generateGroupMap;
exports.getOrGenerateCompiledFile = getOrGenerateCompiledFile;
exports.jsenvCorePathname = jsenvCorePathname;
exports.jsenvPluginCompatMap = jsenvPluginCompatMap;
exports.nodeVersionScoreMap = nodeVersionScoreMap;
exports.readProjectImportMap = readProjectImportMap;
exports.resolveBrowserGroup = resolveBrowserGroup;
exports.resolveNodeGroup = resolveNodeGroup;
exports.resolvePlatformGroup = resolvePlatformGroup;
exports.transformJs = transformJs;
exports.transformResultToCompilationResult = transformResultToCompilationResult;
//# sourceMappingURL=main.js.map
